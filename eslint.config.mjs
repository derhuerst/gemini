import eslint from '@eslint/js'
import globals from 'globals'

export default [
	eslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			globals: globals.node,
		},
		rules: {
			'no-unused-vars': 'off',
		},
	},
]
