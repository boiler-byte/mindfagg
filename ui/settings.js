'use strict';
// mindfagg v28: app-wide editor preferences and a dedicated settings page.
const APP_EDITOR_PREFERENCES_KEY='mfEditorPreferencesV28';
const appEditorSettings={fontSize:null,wordWrap:false,lineNumbers:true,minimap:true,codeFolding:false};
let appSettingsOpen=false;
function appEditorDefaultFontSize(){return window.matchMedia('(max-width:850px)').matches?16:13}
function readAppEditorPreferences(){
  try{
    const stored=JSON.parse(localStorage.getItem(APP_EDITOR_PREFERENCES_KEY)||'null');
    if(!stored||typeof stored!=='object')return;
    const size=Number(stored.fontSize);
    if(stored.fontSize!==null&&Number.isInteger(size)&&size>=8&&size<=16)appEditorSettings.fontSize=size;
    for(const key of ['wordWrap','lineNumbers','minimap','codeFolding'])if(typeof stored[key]==='boolean')appEditorSettings[key]=stored[key];
  }catch(error){console.warn('Editor-Einstellungen konnten nicht geladen werden:',error)}
}
function saveAppEditorPreferences(){
  try{localStorage.setItem(APP_EDITOR_PREFERENCES_KEY,JSON.stringify(appEditorSettings))}
  catch(error){console.warn('Editor-Einstellungen konnten nicht gespeichert werden:',error);toast('Einstellungen konnten nicht gespeichert werden')}
}
function applyAppEditorPreferences(){
  const app=$('.app');if(!app)return;
  app.classList.toggle('editor-wrap',appEditorSettings.wordWrap);
  app.classList.toggle('editor-no-lines',!appEditorSettings.lineNumbers);
  app.classList.toggle('editor-no-minimap',!appEditorSettings.minimap);
  app.classList.toggle('editor-code-folding',appEditorSettings.codeFolding);
  if(appEditorSettings.fontSize===null)document.documentElement.style.removeProperty('--mf-editor-font-size');
  else document.documentElement.style.setProperty('--mf-editor-font-size',appEditorSettings.fontSize+'px');
}
// Logical line positions are expanded when wrapping, keeping the gutter and
// minimap aligned with visible rows instead of assuming one row per newline.
function editorVisualLayout(source,lines){
  const counts=[],offsets=[];let totalRows=0;
  const wrap=appEditorSettings.wordWrap;
  const style=getComputedStyle(source),padding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
  const width=Math.max(1,source.clientWidth-padding);
  const canvas=editorVisualLayout.canvas||(editorVisualLayout.canvas=document.createElement('canvas'));
  const ctx=canvas.getContext('2d');
  if(ctx)ctx.font=style.font;
  const characterWidth=Math.max(1,ctx?.measureText('M').width||8);
  const columns=Math.max(1,Math.floor(width/characterWidth));
  for(const line of lines){
    offsets.push(totalRows);
    let rows=1;
    if(wrap){
      let column=0;
      for(const character of line){
        const cells=character==='\t'?Math.max(1,2-column%2):character.codePointAt(0)>127?Math.max(1,Math.round((ctx?.measureText(character).width||characterWidth)/characterWidth)):1;
        if(column+cells>columns){rows++;column=0}
        column+=cells;
      }
    }
    counts.push(rows);totalRows+=rows;
  }
  return {counts,offsets,totalRows};
}
function editorIndexAtVisualRow(offsets,row){
  if(!offsets.length)return 0;
  let start=0,end=offsets.length;
  while(start<end){const mid=(start+end)>>1;if(offsets[mid]<row)start=mid+1;else end=mid}
  return Math.max(0,start-1);
}
function openAppSettings(){setMobileMenu(false);appSettingsOpen=true;render()}
function closeAppSettings(){appSettingsOpen=false;render()}
function renderAppSettingsPage(){
  const size=appEditorSettings.fontSize??appEditorDefaultFontSize();
  const githubLoggedIn=Boolean(githubCredentialToken);
  $('#surface').innerHTML=`<section class="app-settings-screen" aria-labelledby="appSettingsTitle">
    <div class="app-settings-inner">
      <div class="app-settings-header"><div><div class="app-settings-kicker">mindfagg</div><h1 id="appSettingsTitle">App-Einstellungen</h1><p>Darstellung der Markdown- und Script-Editoren. Diese Einstellungen gelten für alle Projekte.</p></div><button type="button" class="btn" id="closeAppSettings">← Workspace</button></div>
      <div class="app-settings-group" aria-label="Editor-Einstellungen">
        <div class="app-setting-row app-setting-font">
          <div><label for="appFontSize">Schriftgröße</label><small>Schrift im Markdown- und Script-Editor (8–16 px). Standard: Desktop 13 px, Mobil 16 px.</small></div>
          <div class="app-setting-font-control"><output id="appFontSizeValue" for="appFontSize">${size} px</output><input id="appFontSize" type="range" min="8" max="16" step="1" value="${size}" aria-label="Editor-Schriftgröße"></div>
        </div>
        <label class="app-setting-row"><span><strong>Wordwrap</strong><small>Lange Zeilen dynamisch umbrechen, statt horizontal zu scrollen.</small><small class="app-setting-compat-note">Hinweis: Bei aktiviertem Wordwrap sind die klickbaren Knotenmarker, Checkboxen, Status- und Datumsfelder in der Markdown-Quelltextansicht nicht verfügbar.</small></span><input id="appWordWrap" type="checkbox" ${appEditorSettings.wordWrap?'checked':''}></label>
        <label class="app-setting-row"><span><strong>Zeilennummern anzeigen</strong><small>Zeilennummern links neben dem Quelltext.</small></span><input id="appLineNumbers" type="checkbox" ${appEditorSettings.lineNumbers?'checked':''}></label>
        <label class="app-setting-row"><span><strong>Code Folding aktivieren</strong><small>HTML, CSS, JavaScript, SVG, XML und Markdown über die Pfeile neben den Zeilennummern ein- und ausklappen. Standardmäßig deaktiviert.</small><small class="app-setting-compat-note">Hinweis: Solange in der Markdown-Quelltextansicht mindestens ein Abschnitt eingeklappt ist, sind die klickbaren Knotenmarker und Attribute nicht verfügbar. Alle Abschnitte aufklappen, um sie wieder zu verwenden.</small></span><input id="appCodeFolding" type="checkbox" ${appEditorSettings.codeFolding?'checked':''}></label>
        <label class="app-setting-row"><span><strong>Scroll Minimap anzeigen</strong><small>Navigierbare Dokumentübersicht rechts neben dem Quelltext.</small></span><input id="appMinimap" type="checkbox" ${appEditorSettings.minimap?'checked':''}></label>
      </div>
      <section class="app-settings-preview-security" aria-labelledby="appPreviewSecurityTitle">
        <h2 id="appPreviewSecurityTitle">HTML-Vorschau · Sicherheit</h2>
        <p class="app-preview-isolation-note"><strong>Immer isoliert:</strong> HTML-Dateien werden in einem Sandbox-iframe mit eigenem, undurchsichtigem Ursprung ausgeführt. Skripte erhalten keinen Zugriff auf die Hauptanwendung, deren <code>localStorage</code>, <code>IndexedDB</code> oder GitHub-Zugangsdaten. Der bisherige Schalter zur Freigabe des App-Ursprungs wurde entfernt. Projektressourcen werden ausschließlich lesend über die Vorschau-Schnittstelle bereitgestellt.</p>
      </section>
      <section class="app-settings-github" aria-labelledby="appGithubTitle">
        <div class="app-settings-github-heading"><div><h2 id="appGithubTitle">GitHub-Zugangsdaten</h2><p>Einmal anmelden und für alle zugeordneten Projekte wiederverwenden.</p></div><span class="app-settings-credential-state${githubLoggedIn?' is-connected':''}" id="appGithubConnectionState">${escapeHtml(githubCredentialLabel())}</span></div>
        <form id="appGithubForm" class="app-github-credential-form">
          <label for="appGithubToken">Fine-grained Personal Access Token</label>
          <small class="app-settings-token-guide">Fine-grained Token <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">bei GitHub erstellen</a>: Repository auswählen, unter <strong>Repository permissions</strong> für <strong>Contents</strong> die Berechtigung <strong>Read and write</strong> festlegen und den Token hier einfügen.</small>
          <input id="appGithubToken" class="github-secret-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other" required placeholder="github_pat_…" aria-describedby="appGithubNote">
          <div class="app-settings-github-buttons"><button type="submit" class="btn primary" id="appGithubSave">Token prüfen und speichern</button><button type="button" class="btn" id="appGithubRemove" ${githubLoggedIn?'':'disabled'}>Zugang entfernen</button></div>
        </form>
        <small id="appGithubNote" class="app-settings-security-note">Benötigte Repository-Berechtigung: <strong>Contents: Read and write</strong>. Der Token wird verschlüsselt im lokalen Browserspeicher auf diesem Gerät abgelegt. Er ist nicht in Projekt-ZIPs enthalten; Skripte mit Zugriff auf denselben App-Ursprung können ihn jedoch verwenden. Ausschließlich auf vertrauenswürdigem HTTPS oder localhost nutzen.</small>
        <p id="appGithubStatus" class="app-settings-github-status" role="status" aria-live="polite">${githubLoggedIn?'Zugang gespeichert. GitHub-Projekte können ohne erneute Token-Eingabe synchronisiert werden.':'Noch kein GitHub-Zugang gespeichert.'}</p>
      </section>
      <div class="app-settings-footer"><button type="button" class="btn" id="resetAppSettings">Editor-Standardwerte wiederherstellen</button><span id="appSettingsStatus" role="status" aria-live="polite">Änderungen werden automatisch gespeichert.</span></div>
    </div>
  </section>`;
  // Password managers generally ignore a text field. Use native password
  // masking on browsers without -webkit-text-security, rather than expose PATs.
  const githubTokenInput=$('#appGithubToken');
  if(!(typeof CSS!=='undefined'&&CSS.supports('-webkit-text-security','disc')))
    githubTokenInput.type='password';
  $('#closeAppSettings').onclick=closeAppSettings;
  $('#appGithubForm').onsubmit=async event=>{
    event.preventDefault();const token=$('#appGithubToken').value,save=$('#appGithubSave'),remove=$('#appGithubRemove');
    save.disabled=true;remove.disabled=true;
    $('#appGithubStatus').textContent='GitHub-Token wird geprüft …';
    try{
      const account=await githubSaveCredentials(token);
      $('#appGithubToken').value='';
      $('#appGithubConnectionState').textContent='Verbunden als @'+account;
      $('#appGithubConnectionState').classList.add('is-connected');
      $('#appGithubStatus').textContent='Zugang gespeichert. Repository-Zuordnungen bleiben projektbezogen.';
      void githubCheckStatus(project());
    }catch(error){
      $('#appGithubStatus').textContent='Zugang konnte nicht gespeichert werden: '+error.message;
      console.warn('GitHub-Authentifizierung:',error.message);
    }finally{save.disabled=false;remove.disabled=!githubCredentialToken}
  };
  $('#appGithubRemove').onclick=async()=>{
    if(!confirm('Gespeicherte GitHub-Zugangsdaten von diesem Gerät entfernen? Repository-Zuordnungen bleiben erhalten.'))return;
    const remove=$('#appGithubRemove');remove.disabled=true;
    try{
      await githubRemoveCredentials();
      $('#appGithubConnectionState').textContent='Nicht angemeldet';
      $('#appGithubConnectionState').classList.remove('is-connected');
      $('#appGithubStatus').textContent='Zugang entfernt. Lokale Dateien und Repository-Zuordnungen bleiben bestehen.';
      $('#appGithubToken').value='';
    }catch(error){
      $('#appGithubStatus').textContent='Zugang konnte nicht entfernt werden: '+error.message;
      remove.disabled=!githubCredentialToken;
    }
  };
  function changed(){applyAppEditorPreferences();saveAppEditorPreferences();$('#appSettingsStatus').textContent='Einstellungen gespeichert.'}
  $('#appFontSize').oninput=e=>{appEditorSettings.fontSize=Number(e.target.value);$('#appFontSizeValue').textContent=e.target.value+' px';changed()};
  $('#appWordWrap').onchange=e=>{appEditorSettings.wordWrap=e.target.checked;changed()};
  $('#appLineNumbers').onchange=e=>{appEditorSettings.lineNumbers=e.target.checked;changed()};
  $('#appMinimap').onchange=e=>{appEditorSettings.minimap=e.target.checked;changed()};
  $('#appCodeFolding').onchange=e=>{appEditorSettings.codeFolding=e.target.checked;changed()};
  $('#resetAppSettings').onclick=()=>{
    Object.assign(appEditorSettings,{fontSize:null,wordWrap:false,lineNumbers:true,minimap:true,codeFolding:false});
    changed();renderAppSettingsPage();$('#appSettingsStatus').textContent='Standardwerte wiederhergestellt.';
  };
}
readAppEditorPreferences();applyAppEditorPreferences();
