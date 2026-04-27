import eslintConfig from '@n8n/node-cli/eslint';

export default [
	...eslintConfig.default,
	{
		files: ['./nodes/**/*.ts'],
		rules: {
			'n8n-nodes-base/node-param-default-wrong-for-limit': 'off',
			'n8n-nodes-base/node-param-operation-option-action-miscased': 'off',
		},
	},
];
