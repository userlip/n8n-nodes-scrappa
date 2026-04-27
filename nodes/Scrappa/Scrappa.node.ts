import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';
import { ApplicationError, NodeOperationError } from 'n8n-workflow';

type OperationDefinition = {
	method: 'GET' | 'POST';
	path: string;
	required: string[];
	paramMap: Record<string, string>;
	maxLimit?: number;
};

const OPERATION_DEFINITIONS: Record<string, OperationDefinition> = {
	googleSearch: {
		method: 'GET',
		path: '/api/search',
		required: ['query'],
		paramMap: { query: 'query', country: 'gl', language: 'hl', pageZeroBased: 'page', limit: 'amount' },
		maxLimit: 10,
	},
	googleMapsSearch: {
		method: 'GET',
		path: '/api/maps/advance-search',
		required: ['query'],
		paramMap: { query: 'query', latitude: 'lat', longitude: 'lon', zoom: 'zoom', country: 'gl', language: 'hl', pageZeroBased: 'page', limit: 'limit' },
	},
	googleMapsDetails: {
		method: 'GET',
		path: '/api/maps/business-details',
		required: ['businessId'],
		paramMap: { businessId: 'business_id', language: 'hl', country: 'gl' },
	},
	youtubeSearch: {
		method: 'GET',
		path: '/api/youtube/search',
		required: ['query'],
		paramMap: { query: 'query', country: 'gl', language: 'hl', page: 'page', limit: 'limit' },
		maxLimit: 20,
	},
	youtubeVideo: {
		method: 'GET',
		path: '/api/youtube/video',
		required: ['videoId'],
		paramMap: { videoId: 'video_id', language: 'hl', country: 'gl' },
	},
	linkedinProfile: {
		method: 'GET',
		path: '/api/linkedin/profile',
		required: ['url'],
		paramMap: { url: 'url', useCache: 'use_cache', maximumCacheAge: 'maximum_cache_age' },
	},
	linkedinCompany: {
		method: 'GET',
		path: '/api/linkedin/company',
		required: ['url'],
		paramMap: { url: 'url', useCache: 'use_cache', maximumCacheAge: 'maximum_cache_age' },
	},
	linkedinJobsSearch: {
		method: 'GET',
		path: '/api/linkedin/jobs/search',
		required: ['query'],
		paramMap: { query: 'query', country: 'gl', language: 'hl', page: 'page', limit: 'num' },
		maxLimit: 20,
	},
	trustpilotCompanySearch: {
		method: 'GET',
		path: '/api/trustpilot/company-search',
		required: ['query'],
		paramMap: { query: 'query', country: 'country', page: 'page', limit: 'per_page' },
	},
	trustpilotCompanyReviews: {
		method: 'GET',
		path: '/api/trustpilot/company-reviews',
		required: ['companyDomain'],
		paramMap: { companyDomain: 'company_domain', query: 'query', page: 'page', limit: 'per_page', rating: 'rating' },
	},
};

function addValue(query: Record<string, string | number | boolean>, key: string, value: unknown): void {
	if (value === undefined || value === null || value === '') {
		return;
	}

	query[key] = value as string | number | boolean;
}

function clampOperationLimit(definition: OperationDefinition | undefined, query: Record<string, string | number | boolean>): void {
	if (!definition?.maxLimit) {
		return;
	}

	const limitParameterName = definition.paramMap.limit;
	const limitValue = query[limitParameterName];

	if (typeof limitValue === 'number') {
		query[limitParameterName] = Math.min(limitValue, definition.maxLimit);
		return;
	}

	if (typeof limitValue === 'string' && limitValue.trim()) {
		const parsedLimit = Number(limitValue);

		if (Number.isFinite(parsedLimit)) {
			query[limitParameterName] = Math.min(parsedLimit, definition.maxLimit);
		}
	}
}

function parseJsonObjectParameter(rawValue: unknown, parameterName: string): Record<string, unknown> {
	if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
		return rawValue as Record<string, unknown>;
	}

	if (typeof rawValue !== 'string') {
		throw new ApplicationError(`${parameterName} must be a valid JSON object.`);
	}

	if (!rawValue.trim()) {
		return {};
	}

	try {
		const parsed = JSON.parse(rawValue) as unknown;

		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new ApplicationError('Expected a JSON object.');
		}

		return parsed as Record<string, unknown>;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid JSON.';
		throw new ApplicationError(`${parameterName} must be a valid JSON object. ${message}`);
	}
}

function normalizePath(path: string): string {
	const trimmedPath = path.trim();

	if (!trimmedPath) {
		throw new ApplicationError('Custom endpoint path is required.');
	}

	if (/^[a-z][a-z\d+.-]*:/i.test(trimmedPath) || trimmedPath.startsWith('//') || trimmedPath.includes('\\')) {
		throw new ApplicationError('Custom endpoint path must be a relative Scrappa API path.');
	}

	const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;

	if (!normalizedPath.startsWith('/api/')) {
		throw new ApplicationError('Custom endpoint path must start with /api/.');
	}

	return normalizedPath;
}

export class Scrappa implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Scrappa',
		name: 'scrappa',
		icon: 'file:scrappa.svg',
		group: ['transform'],
		version: 1,
		usableAsTool: true,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Use Scrappa web scraping, search, maps, video, LinkedIn, and review data APIs.',
		defaults: {
			name: 'Scrappa',
		},
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		credentials: [
			{
				name: 'scrappaApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://scrappa.co',
			headers: {
				Accept: 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: 'googleSearch',
				noDataExpression: true,
				options: [
					{ name: 'Custom Endpoint', value: 'customEndpoint' },
					{ name: 'Google Map', value: 'googleMaps' },
					{ name: 'Google Search', value: 'googleSearch' },
					{ name: 'LinkedIn', value: 'linkedin' },
					{ name: 'Trustpilot', value: 'trustpilot' },
					{ name: 'YouTube', value: 'youtube' },
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'customEndpoint',
				noDataExpression: true,
				options: [
					{ action: 'Call a custom endpoint', name: 'Custom Endpoint', value: 'customEndpoint' },
				],
				displayOptions: {
					show: {
						resource: ['customEndpoint'],
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'googleMapsSearch',
				noDataExpression: true,
				options: [
					{ action: 'Get Google Maps business details', name: 'Google Maps: Business Details', value: 'googleMapsDetails' },
					{ action: 'Search Google Maps places', name: 'Google Maps: Search Places', value: 'googleMapsSearch' },
				],
				displayOptions: {
					show: {
						resource: ['googleMaps'],
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'googleSearch',
				noDataExpression: true,
				options: [
					{ action: 'Search Google', name: 'Google Search', value: 'googleSearch' },
				],
				displayOptions: {
					show: {
						resource: ['googleSearch'],
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'linkedinProfile',
				noDataExpression: true,
				options: [
					{ action: 'Get LinkedIn company data', name: 'LinkedIn: Company', value: 'linkedinCompany' },
					{ action: 'Search LinkedIn jobs', name: 'LinkedIn: Jobs Search', value: 'linkedinJobsSearch' },
					{ action: 'Get LinkedIn profile data', name: 'LinkedIn: Profile', value: 'linkedinProfile' },
				],
				displayOptions: {
					show: {
						resource: ['linkedin'],
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'trustpilotCompanySearch',
				noDataExpression: true,
				options: [
					{ action: 'Get Trustpilot company reviews', name: 'Trustpilot: Company Reviews', value: 'trustpilotCompanyReviews' },
					{ action: 'Search Trustpilot companies', name: 'Trustpilot: Company Search', value: 'trustpilotCompanySearch' },
				],
				displayOptions: {
					show: {
						resource: ['trustpilot'],
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'youtubeSearch',
				noDataExpression: true,
				options: [
					{ action: 'Search YouTube', name: 'YouTube: Search', value: 'youtubeSearch' },
					{ action: 'Get YouTube video details', name: 'YouTube: Video Details', value: 'youtubeVideo' },
				],
				displayOptions: {
					show: {
						resource: ['youtube'],
					},
				},
			},
			{
				displayName: 'Custom Endpoint Path',
				name: 'customPath',
				type: 'string',
				default: '/api/search',
				placeholder: '/api/search',
				required: true,
				description: 'Any Scrappa API path, for example /api/google/news',
				displayOptions: {
					show: {
						operation: ['customEndpoint'],
					},
				},
			},
			{
				displayName: 'HTTP Method',
				name: 'customMethod',
				type: 'options',
				default: 'GET',
				options: [
					{ name: 'GET', value: 'GET' },
					{ name: 'POST', value: 'POST' },
				],
				displayOptions: {
					show: {
						operation: ['customEndpoint'],
					},
				},
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['googleSearch', 'googleMapsSearch', 'youtubeSearch', 'linkedinJobsSearch', 'trustpilotCompanySearch'],
					},
				},
			},
			{
				displayName: 'Video ID',
				name: 'videoId',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'dQw4w9WgXcQ',
				displayOptions: {
					show: {
						operation: ['youtubeVideo'],
					},
				},
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['linkedinProfile', 'linkedinCompany'],
					},
				},
			},
			{
				displayName: 'Business ID',
				name: 'businessId',
				type: 'string',
				default: '',
				required: true,
				description: 'Google Maps business ID or place ID',
				displayOptions: {
					show: {
						operation: ['googleMapsDetails'],
					},
				},
			},
			{
				displayName: 'Company Domain',
				name: 'companyDomain',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'amazon.com',
				displayOptions: {
					show: {
						operation: ['trustpilotCompanyReviews'],
					},
				},
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				placeholder: 'us',
				description: 'Country or region code where supported',
				displayOptions: {
					show: {
						operation: ['googleSearch', 'googleMapsSearch', 'googleMapsDetails', 'youtubeSearch', 'youtubeVideo', 'linkedinJobsSearch', 'trustpilotCompanySearch'],
					},
				},
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Interface language code where supported',
				displayOptions: {
					show: {
						operation: ['googleSearch', 'googleMapsSearch', 'googleMapsDetails', 'youtubeSearch', 'youtubeVideo', 'linkedinJobsSearch'],
					},
				},
			},
			{
				displayName: 'Latitude',
				name: 'latitude',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						operation: ['googleMapsSearch'],
					},
				},
			},
			{
				displayName: 'Longitude',
				name: 'longitude',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						operation: ['googleMapsSearch'],
					},
				},
			},
			{
				displayName: 'Zoom',
				name: 'zoom',
				type: 'number',
				default: 13,
				displayOptions: {
					show: {
						operation: ['googleMapsSearch'],
					},
				},
			},
			{
				displayName: 'Page',
				name: 'pageZeroBased',
				type: 'number',
				default: 0,
				description: 'Zero-based page number',
				typeOptions: {
					minValue: 0,
				},
				displayOptions: {
					show: {
						operation: ['googleSearch', 'googleMapsSearch'],
					},
				},
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				description: 'Page number',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						operation: ['youtubeSearch', 'linkedinJobsSearch', 'trustpilotCompanySearch', 'trustpilotCompanyReviews'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 10,
				description: 'Max number of results to return',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				displayOptions: {
					show: {
						operation: ['googleSearch', 'googleMapsSearch', 'youtubeSearch', 'linkedinJobsSearch', 'trustpilotCompanySearch', 'trustpilotCompanyReviews'],
					},
				},
			},
			{
				displayName: 'Rating',
				name: 'rating',
				type: 'string',
				default: '',
				placeholder: '4,5',
				displayOptions: {
					show: {
						operation: ['trustpilotCompanyReviews'],
					},
				},
			},
			{
				displayName: 'Use Cache',
				name: 'useCache',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['linkedinProfile', 'linkedinCompany'],
					},
				},
			},
			{
				displayName: 'Maximum Cache Age',
				name: 'maximumCacheAge',
				type: 'number',
				default: 3600,
				description: 'Maximum cache age in seconds for LinkedIn endpoints',
				displayOptions: {
					show: {
						operation: ['linkedinProfile', 'linkedinCompany'],
					},
				},
			},
			{
				displayName: 'Additional Query Parameters',
				name: 'additionalQueryParameters',
				type: 'json',
				default: '{}',
				description: 'Extra query parameters as a JSON object. These override generated parameters when keys match.',
			},
			{
				displayName: 'JSON Body',
				name: 'body',
				type: 'json',
				default: '{}',
				description: 'Request body for POST custom endpoint calls',
				displayOptions: {
					show: {
						operation: ['customEndpoint'],
						customMethod: ['POST'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const additionalQueryParameters = parseJsonObjectParameter(
					this.getNodeParameter('additionalQueryParameters', itemIndex, '{}'),
					'Additional query parameters',
				);

				const query: Record<string, string | number | boolean> = {};
				let method: 'GET' | 'POST';
				let path: string;
				let body: Record<string, unknown> | undefined;
				let operationDefinition: OperationDefinition | undefined;

				if (operation === 'customEndpoint') {
					method = this.getNodeParameter('customMethod', itemIndex) as 'GET' | 'POST';
					path = normalizePath(this.getNodeParameter('customPath', itemIndex) as string);

					if (method === 'POST') {
						body = parseJsonObjectParameter(this.getNodeParameter('body', itemIndex, '{}'), 'JSON body');
					}
				} else {
					const definition = OPERATION_DEFINITIONS[operation];

					if (!definition) {
						throw new NodeOperationError(this.getNode(), `Unknown Scrappa operation: ${operation}`, {
							itemIndex,
						});
					}

					method = definition.method;
					path = definition.path;
					operationDefinition = definition;

					for (const parameterName of definition.required) {
						const value = this.getNodeParameter(parameterName, itemIndex, '') as string;

						if (!value) {
							throw new NodeOperationError(this.getNode(), `${parameterName} is required for this operation.`, {
								itemIndex,
							});
						}
					}

					for (const [nodeParameterName, apiParameterName] of Object.entries(definition.paramMap)) {
						addValue(query, apiParameterName, this.getNodeParameter(nodeParameterName, itemIndex, ''));
					}
				}

				for (const [key, value] of Object.entries(additionalQueryParameters)) {
					addValue(query, key, value);
				}

				clampOperationLimit(operationDefinition, query);

				const requestOptions: IHttpRequestOptions = {
					method,
					baseURL: 'https://scrappa.co',
					url: path,
					qs: query,
					json: true,
				};

				if (body) {
					requestOptions.body = body;
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'scrappaApi',
					requestOptions,
				);

				returnData.push({
					json: response as IDataObject,
					pairedItem: {
						item: itemIndex,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}

				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
