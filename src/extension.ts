/* eslint-disable @typescript-eslint/no-unused-vars */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export const extensionId = "PNDA.nml-language";

export function activate(context: vscode.ExtensionContext): void {
	const lang = "newgrfml";

	const resourcesDir = path.join(vscode.extensions.getExtension(extensionId).extensionPath, "resources");
	const documentationPath = path.join(resourcesDir, "docs.json");
	const documentation = JSON.parse(fs.readFileSync(documentationPath, "utf8"));

	const hoverProvider = vscode.languages.registerHoverProvider(lang, {
		provideHover(document: vscode.TextDocument, position: vscode.Position, ) : vscode.Hover {
			const range = document.getWordRangeAtPosition(position);
			const text = document.getText(range);
			const content: vscode.MarkdownString = new vscode.MarkdownString(documentation[text].description, true);
			if (documentation[text].example !== undefined)
				content.appendCodeblock(documentation[text].example);
			return new vscode.Hover([{language: lang, value: documentation[text].title}, content], range);
		}
	});

	const providersPath = path.join(resourcesDir, "providers.json");
	const providers = JSON.parse(fs.readFileSync(providersPath, "utf8"));

	const blockProvider = vscode.languages.registerCompletionItemProvider(lang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, ) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return providers["block"].map((element: string) => {
				return new vscode.CompletionItem(element, vscode.CompletionItemKind.Function);
			});
		}
	});

	const variablesProvider = vscode.languages.registerCompletionItemProvider(lang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return providers["variables"].map((element: string) => {
				return new vscode.CompletionItem(element, vscode.CompletionItemKind.Variable);
			});
		}
	});

	const featureProvider = vscode.languages.registerCompletionItemProvider(lang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return providers["features"].map((element: string) => {
				return new vscode.CompletionItem(element, vscode.CompletionItemKind.Keyword);
			});
		}
	});

	const callbackProvider = vscode.languages.registerCompletionItemProvider(lang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return providers["callback"].map((element: string) => {
				return element.toLowerCase() == element // values/constants are always uppercase
					? new vscode.CompletionItem(element, vscode.CompletionItemKind.Property)
					: new vscode.CompletionItem(element, vscode.CompletionItemKind.Value);
			});
		}
	});

	context.subscriptions.push(hoverProvider, blockProvider, variablesProvider, featureProvider, callbackProvider);
}
