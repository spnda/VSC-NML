/* eslint-disable @typescript-eslint/no-unused-vars */

import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import * as vscode from "vscode";

export const nmlExtensionId = "PNDA.nml-language";
export const newgrfmlLang = "newgrfml";

const languageStrings = new Map<string, string>();
let languageId = 0xFF;
let targetLanguageId = 0x01;

function getConfig() {
	return vscode.workspace.getConfiguration(newgrfmlLang);
}

function getTargetLanguageID() {
	const id = getConfig().get<number>("languageId");
	if (id === undefined)
		return 0x01;
	return id;
}

function getLanguageFolder() {
	const langFolder = getConfig().get<string>("languageFolder");
	if (langFolder === undefined)
		return "lang";
	return langFolder;
}

function isInLanguageFolder(path: string) {
	return vscode.workspace.asRelativePath(path).startsWith(getLanguageFolder());
}

async function updateLanguageStrings(path: string) {
	// Reset all the strings beforehand.
	languageStrings.clear();

	if (!isInLanguageFolder(path))
		return;

	console.log("Target ID: " + targetLanguageId);

	const file = fs.createReadStream(path);
	const rl = readline.createInterface({input: file, crlfDelay: Infinity});
	for await (const line of rl) {
		if (line.startsWith("##")) {
			if (line.startsWith("##grflangid")) {
				const id = parseInt(line.slice(12));
				if (isNaN(id))
					return;
				if (id > languageId && id != targetLanguageId)
					return;
				languageId = id;
				console.log(id);
			}

			continue;
		}

		const idx = line.indexOf(":");
		const [key, value] = [line.slice(0, idx), line.slice(idx + 1)];
		if (key === undefined || value === undefined)
			continue;
		languageStrings.set(key.trim(), value.trimEnd());
	}
}

async function updateLanguageFiles() {
	languageStrings.clear();

	for (const file of await vscode.workspace.findFiles(`${getLanguageFolder()}/*.lng`)) {
		updateLanguageStrings(file.fsPath);
	}
}

export function activate(context: vscode.ExtensionContext): void {
	updateLanguageFiles();
	targetLanguageId = getTargetLanguageID();

	const resourcesDir = path.join(vscode.extensions.getExtension(nmlExtensionId).extensionPath, "resources");
	const documentationPath = path.join(resourcesDir, "docs.json");
	const documentation = JSON.parse(fs.readFileSync(documentationPath, "utf8"));

	const hoverProvider = vscode.languages.registerHoverProvider(newgrfmlLang, {
		provideHover(document: vscode.TextDocument, position: vscode.Position, ) : vscode.Hover {
			const range = document.getWordRangeAtPosition(position);
			const text = document.getText(range);

			// Show the value of the language string if it exists
			if (languageStrings.has(text)) {
				const content = new vscode.MarkdownString("", false);
				content.appendCodeblock(`"${languageStrings.get(text)}"`);
				return new vscode.Hover([{language: newgrfmlLang, value: text}, content], range);
			}

			if (documentation[text] === undefined)
				return null;

			const content = new vscode.MarkdownString(documentation[text].description, false);
			if (documentation[text].example !== undefined)
				content.appendCodeblock(documentation[text].example);
			return new vscode.Hover([{language: newgrfmlLang, value: documentation[text].title}, content], range);
		}
	});

	const providersPath = path.join(resourcesDir, "providers.json");
	const providers = JSON.parse(fs.readFileSync(providersPath, "utf8"));

	const blockProvider = vscode.languages.registerCompletionItemProvider(newgrfmlLang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, ) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return providers["block"].map((element: string) => {
				return new vscode.CompletionItem(element, vscode.CompletionItemKind.Function);
			});
		}
	});

	const variablesProvider = vscode.languages.registerCompletionItemProvider(newgrfmlLang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return providers["variables"].map((element: string) => {
				return new vscode.CompletionItem(element, vscode.CompletionItemKind.Variable);
			});
		}
	});

	const featureProvider = vscode.languages.registerCompletionItemProvider(newgrfmlLang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return providers["features"].map((element: string) => {
				return new vscode.CompletionItem(element, vscode.CompletionItemKind.Keyword);
			});
		}
	});

	const callbackProvider = vscode.languages.registerCompletionItemProvider(newgrfmlLang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return providers["callback"].map((element: string) => {
				return element.toLowerCase() == element // values/constants are always uppercase
					? new vscode.CompletionItem(element, vscode.CompletionItemKind.Property)
					: new vscode.CompletionItem(element, vscode.CompletionItemKind.Value);
			});
		}
	});

	// Provider callback for language string keys
	const languageStringProvider = vscode.languages.registerCompletionItemProvider(newgrfmlLang, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) : vscode.CompletionItem[] | Thenable<vscode.CompletionItem[]> {
			return Array.from(languageStrings.keys()).map((element: string) => {
				return new vscode.CompletionItem(element, vscode.CompletionItemKind.Text);
			});
		}
	});

	context.subscriptions.push(hoverProvider, blockProvider, variablesProvider, featureProvider, callbackProvider, languageStringProvider);

	vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		if (document.languageId === "lng" /*&& document.uri.scheme === "file"*/) {
			updateLanguageStrings(document.uri.fsPath);
		}
	});

	vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
		if (event.affectsConfiguration("newgrfml.languageFolder")) {
			updateLanguageFiles();
		}
		if (event.affectsConfiguration("newgrfml.languageId")) {
			targetLanguageId = getTargetLanguageID();
			updateLanguageFiles();
		}
	});

	vscode.workspace.onDidChangeWorkspaceFolders((event: vscode.WorkspaceFoldersChangeEvent) => {
		// Always reload the language files when we change workspaces.
		updateLanguageFiles();
	});

	vscode.workspace.onDidRenameFiles((event: vscode.FileRenameEvent) => {
		// Check if any files were renamed that have the lng extension.
		let languageFileChanged = false;
		for (const file of event.files) {
			console.log(file.newUri.fsPath);
			if (vscode.workspace.asRelativePath(file.newUri.fsPath).startsWith(getLanguageFolder())) {
				languageFileChanged = true;
			}
			if (file.newUri.fsPath.endsWith(".lng")) {
				languageFileChanged = true;
			}
		}
		if (languageFileChanged)
			updateLanguageFiles();
	});
}
