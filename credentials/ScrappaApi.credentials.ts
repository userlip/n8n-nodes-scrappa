import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ScrappaApi implements ICredentialType {
	name = 'scrappaApi';

	displayName = 'Scrappa API';

	icon = 'file:scrappa.svg' as const;

	documentationUrl = 'https://scrappa.co/docs/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Create an API key in your Scrappa dashboard.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-KEY': '={{$credentials.apiKey}}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://scrappa.co',
			url: '/api/auth/check',
			method: 'GET',
		},
	};
}
