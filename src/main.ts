import { PartialMessage } from './../node_modules/esbuild/lib/main.d';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter } from 'obsidian';
import { MnemonicWallet } from './mnemonic-wallet';
// Remember to rename these classes and interfaces!

interface PerliteSyncSettings {
    passphrase: string;
    address: string;
}

const DEFAULT_SETTINGS: PerliteSyncSettings = {
    passphrase: '',
    address: ''
}

export default class PerliteSyncPlugin extends Plugin {
    settings: PerliteSyncSettings;
    mnemonicWallet: MnemonicWallet;
    async onload() {
        await this.loadSettings();
        try {
            this.mnemonicWallet = new MnemonicWallet(this.settings.passphrase);
            console.log(this.mnemonicWallet.getAddress());
        } catch (error) {
            console.error("init mnemonic wallet failed");
        }
        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon('dice', 'PerliteSync', (evt: MouseEvent) => {
            try {
                const fs = require('fs');
                const path = require('path');
                const files = this.app.vault.getMarkdownFiles();
                const outputDir = 'C:\\Users\\77658\\Documents\\testcopy_obsidian';
                const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
                
                fs.mkdirSync(outputDir, { recursive: true });

                for (const file of files) {
                    const sourcePath = path.join(vaultPath, file.path);
                    const targetPath = path.join(outputDir, file.path);
                    
                    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                    fs.copyFileSync(sourcePath, targetPath);
                }
                
                new Notice(`成功复制 ${files.length} 个文件到目录`);
            } catch (error) {
                new Notice('文件复制失败: ' + error.message);
                console.error(error);
            }
        });
        // Perform additional things with the ribbon
        ribbonIconEl.addClass('my-plugin-ribbon-class');

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Status Bar Text');

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'open-sample-modal-simple',
            name: 'Open sample modal (simple)',
            callback: () => {
                new SampleModal(this.app).open();
            }
        });
        // This adds an editor command that can perform some operation on the current editor instance
        this.addCommand({
            id: 'sample-editor-command',
            name: 'Sample editor command',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                console.log(editor.getSelection());
                editor.replaceSelection('Sample Editor Command');
            }
        });
        // This adds a complex command that can check whether the current state of the app allows execution of the command
        this.addCommand({
            id: 'open-sample-modal-complex',
            name: 'Open sample modal (complex)',
            checkCallback: (checking: boolean) => {
                // Conditions to check
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView) {
                    // If checking is true, we're simply "checking" if the command can be run.
                    // If checking is false, then we want to actually perform the operation.
                    if (!checking) {
                        new SampleModal(this.app).open();
                    }

                    // This command will only show up in Command Palette when the check function returns true
                    return true;
                }
            }
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new PerliteSyncSettingTab(this.app, this));

        // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // Using this function will automatically remove the event listener when this plugin is disabled.
        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            console.log('click', evt);
        });

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.setText('Woah!');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


class PerliteSyncSettingTab extends PluginSettingTab {
    plugin: PerliteSyncPlugin;

    constructor(app: App, plugin: PerliteSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        new Setting(containerEl)
            .setName('Passphrase')
            .setDesc('passphrase')
            .addText(text => text
                .setPlaceholder('Enter your passphrase')
                .setValue(this.plugin.settings.passphrase)
                .onChange(async (value) => {
                    this.plugin.settings.passphrase = value;
                    await this.plugin.saveSettings();
                }));
    }
}