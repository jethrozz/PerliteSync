import { PartialMessage } from './../node_modules/esbuild/lib/main.d';
import { init, push } from './perlite_sync';
import { App, Editor, MarkdownView, Modal, Menu, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter } from 'obsidian';
import { MnemonicWallet } from './mnemonic-wallet';
import { SealUtil } from './utils/sealUtil';
// Remember to rename these classes and interfaces!

interface PerliteSyncSettings {
    passphrase: string;
    address: string;
}

const DEFAULT_SETTINGS: PerliteSyncSettings = {
    passphrase: 'table bar seat almost seven decrease nuclear series basket about render bless',
    address: ''
}

export default class PerliteSyncPlugin extends Plugin {
    settings: PerliteSyncSettings;
    mnemonicWallet: MnemonicWallet;
    async onload() {
        await this.loadSettings();
        try {
            if (this.settings.passphrase === '') {
                new Notice('请先配置perlite sync 插件');
            } else {
                this.mnemonicWallet = new MnemonicWallet(this.settings.passphrase);
                console.log(this.mnemonicWallet.getAddress());
            }

        } catch (error) {
            console.error("init mnemonic wallet failed");
        }
        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon('folder-sync', 'PerliteSync', (evt: MouseEvent) => {
            if (this.settings.passphrase === '') {
                new Notice('请先配置perlite sync 插件');
                return;
            }
            let dataAdapter = this.app.vault.adapter;
            let props = {
                policyObject: '0x89dd28871bd4ef4c0428eb4a591e9215d744765dcaa037d6ae454b837ea085c5',
                cap_id: '0x36dd69ef377b3ca0c86cf7106c40c3d4e6ba44d149844ea945b097cb5b8d5b2d',
                moduleName: 'allowlist',
                wallet: this.mnemonicWallet
            };
            const menu = new Menu();
            menu.addItem((item) =>
                item
                   .setTitle('init')
                   .setIcon('webhook')
                   .onClick(() => {
                        const allFiles = this.app.vault.getFiles();
                        console.log(this.app.vault.getRoot());
                        console.log(this.app.vault.getName());
                        console.log(this.app.vault.getMarkdownFiles());

            }));
            menu.addItem((item) =>
                item
                    .setTitle('push')
                    .setIcon('book-up')
                    .onClick(async () => {
                        new Notice('push to walrus');
                        try{
                            //const { handleSubmit, displayUpload, handlePublish } = SealUtil(props);
                            //上传文件
                            const fs = require('fs');
                            const path = require('path');
                            const files = this.app.vault.getMarkdownFiles();
    
                            //const outputDir = 'C:\\Users\\77658\\Documents\\testcopy_obsidian';
                            const outputDir = '/Users/77658/Documents/testcopy_obsidian';
                            const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
                            const vaultName = this.app.vault.getName();
                            await push(vaultName, vaultPath, files, this.mnemonicWallet);
                            // const sourcePath = path.join(vaultPath, files[0].path);
                            // console.log("ready to submit", sourcePath); 
                            // fs.readFile(sourcePath, async (err: any, data: any) => {
                            //     if (err) {
                            //         console.error("读取文件失败:", err);
                            //         return;
                            //     }
                            //     const fileName = path.basename(sourcePath);
                            //     let file = new File([data], fileName, {
                            //         type: 'text/plain',
                            //         lastModified: Date.now()
                            //     });
                            //     console.log("文件内容:", file);
                            //     const result = await handleSubmit(file);
                            //     //发布文件
                            //     handlePublish(props.policyObject, result.blobId);
                            //     new Notice(`成功发布 ${files.length} 个文件到合约`);
                            // });
                        }catch(e){
                            console.log(e);
                        }
                    })
            );

            menu.addItem((item) =>
                item
                    .setTitle('pull')
                    .setIcon('book-down')
                    .onClick(() => {
                        try{
                            new Notice('pull from walrus');
                            //const { downloadFile } = SealUtil(props);
                            //const blob_id = "hryIYynN-rKTDEfxKSGxlYX6UMjtS1ytmGN3f4aAMV8";
                            //downloadFile(blob_id, dataAdapter);
                        }catch(e){
                            console.log(e);
                        }
                    })
            );


            menu.showAtMouseEvent(evt);
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
                    try {
                        if (value != "" && this.plugin.settings.passphrase != value) {
                            this.plugin.mnemonicWallet = new MnemonicWallet(value);
                        }
                    } catch (error) {
                        console.error("init mnemonic wallet failed");
                    }
                    this.plugin.settings.passphrase = value;
                    await this.plugin.saveSettings();
                }));
    }
}