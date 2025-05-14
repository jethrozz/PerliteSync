import { PartialMessage } from './../node_modules/esbuild/lib/main.d';
import { init, pull, push } from './perlite_sync';
import { App, Editor, MarkdownView, Modal, Menu, Notice, Plugin, PluginSettingTab, Setting, FileSystemAdapter } from 'obsidian';
import { MnemonicWallet } from './mnemonic-wallet';
import { SealUtil } from './utils/sealUtil';
import { PerliteVault } from './server/perlite_server';
// Remember to rename these classes and interfaces!

interface PerliteSyncSettings {
    passphrase: string;
    address: string;
    epoch: number;
}

const DEFAULT_SETTINGS: PerliteSyncSettings = {
    passphrase: '',
    address: '',
    epoch: 10
}

export class ConfirmModal extends Modal {
    text: string;
    constructor(app: App, text: string) {
      super(app);
      this.app = app;
      this.text = text;
    }
  
    onOpen() {
      const { contentEl } = this;
      contentEl.setText(this.text+"\n");
      contentEl.createDiv()
      const confirmButton = contentEl.createEl('button');
      confirmButton.innerText = '确定';
      confirmButton.onclick = () => {
        // 用户点击确定后的操作
        this.close();
      };
  
     /* const cancelButton = contentEl.createEl('button');
      cancelButton.innerText = '取消';
      cancelButton.onclick = () => {
        // 用户点击取消后的操作
        this.close();
      };*/
    }
}


export default class PerliteSyncPlugin extends Plugin {
    settings: PerliteSyncSettings;
    mnemonicWallet: MnemonicWallet;
    vault: PerliteVault | undefined;
    epoch: number;
    
    
    
    async onload() {
        await this.loadSettings();
        try {
            this.app
            if (this.settings.passphrase === '') {
                new Notice('请先配置perlite sync 插件');
            } else {
                this.mnemonicWallet = new MnemonicWallet(this.settings.passphrase);
                console.log(this.mnemonicWallet.getAddress());
            }
            this.epoch = this.settings.epoch;
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
            const menu = new Menu();
            menu.addItem((item) =>
                item
                   .setTitle('init')
                   .setIcon('webhook')
                   .onClick( async () => {
                        //const allFiles = this.app.vault.getFiles();
                        //const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
                        const vaultName = this.app.vault.getName();
                        this.vault = await init(vaultName, this.getMnemonicWallet());
                        console.log("vault", this.vault);
                        if(this.vault){
                            new Notice('init success, vaultId:'+this.vault.id+'vaultName:'+this.vault.name);
                        }else{
                            new Notice('init failed');
                        }
                    })
            );
            menu.addItem((item) =>
                item
                    .setTitle('push')
                    .setIcon('book-up')
                    .onClick(async () => {
                        new Notice('push to walrus');
                        try{
                            //const { handleSubmit, displayUpload, handlePublish } = SealUtil(props);
                            //上传文件
                            //const fs = require('fs');
                            //const path = require('path');
                            const files = this.app.vault.getMarkdownFiles();
    
                            //const outputDir = 'C:\\Users\\77658\\Documents\\testcopy_obsidian';
                            //const outputDir = '/Users/77658/Documents/testcopy_obsidian';
                            const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
                            const vaultName = this.app.vault.getName();
                            let vault = await init(vaultName, this.getMnemonicWallet());
                            if(vault){
                                await push(vault, vaultPath, files, this.getMnemonicWallet(), this.getEpoch(), this.newNotice.bind(this), this.app);
                            }
                        }catch(e){
                            console.log(e);
                        }
                    })
            );

            menu.addItem((item) =>
                item
                    .setTitle('pull')
                    .setIcon('book-down')
                    .onClick(async () => {
                        try{
                            new Notice('pull from walrus');
                            const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
                            const vaultName = this.app.vault.getName();
                            const files = this.app.vault.getMarkdownFiles();
                            let vault = await init(vaultName, this.getMnemonicWallet());
                            if(!vault){
                                new Notice('pull failed, please init first');
                                return;
                            }
                            pull(vault, vaultPath,files, this.mnemonicWallet, dataAdapter);
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
        statusBarItemEl.setText('perlite sync status bar');

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

    setEpoch(epoch: number) {
        this.epoch = epoch;
    }
    newNotice(message: string) {
        new Notice(message);
    }
    getEpoch() {
        return this.epoch;
    }

    getMnemonicWallet() {
        return this.mnemonicWallet;
    }
    onunload() {
        this.mnemonicWallet.destory();
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
                new Setting(containerEl)
                .setName('Epoch')
                .setDesc('file storage on walrus epoch numbers')
                .addText(text => text
                    .setPlaceholder('Enter save Epoch number, default is 10')
                    .setValue(this.plugin.settings.epoch.toString())
                    .onChange(async (value) => {
                        try {
                            let tempEpoch = parseInt(value);
                            if (tempEpoch>0) {
                                this.plugin.settings.epoch = tempEpoch;
                                await this.plugin.loadSettings();
                                this.plugin.setEpoch(tempEpoch);
                            }
                        } catch (error) {
                            console.error("Epoch value is not valid");
                        }
                    }));
    }
}