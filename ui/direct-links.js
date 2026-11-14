'use strict';
// v66: A breadcrumb copies a link to the currently selected local project,
// document and actual view. The link only contains IDs, never document data.
function directLinkCurrentView(doc=documentNow()){
  if(!doc)return null;
  if(fileKind(doc)==='markdown')return VIEWS.includes(view)?view:'markdown';
  const panels=filePanelOptions(doc);
  return panels.some(panel=>panel.id===activeFilePanel)?activeFilePanel:(panels[0]?.id||'file');
}
function directLinkUrl(){
  const p=project(),d=documentNow();
  if(appSettingsOpen||!p||!d||d.projectId!==p.id)return null;
  const url=new URL(window.location.href);
  // Existing query parameters not belonging to the app's route are retained.
  for(const key of ['project','fileId','view'])url.searchParams.delete(key);
  url.searchParams.set('project',p.id);
  url.searchParams.set('fileId',d.id);
  url.searchParams.set('view',directLinkCurrentView(d));
  url.hash='';
  return url.href;
}
function directLinkFromSearch(search=window.location.search){
  const params=new URLSearchParams(search);
  if(!['project','fileId','view'].some(key=>params.has(key)))return null;
  const requestedProject=params.get('project'),requestedFile=params.get('fileId');
  if(!requestedProject||!requestedFile)return {error:'Direktlink unvollständig: Projekt und Datei fehlen.'};
  const p=projects.find(item=>item.id===requestedProject);
  const d=docs.find(item=>item.id===requestedFile&&item.projectId===requestedProject);
  if(!p||!d)return {error:'Direktlink nicht verfügbar: Projekt oder Datei ist in diesem Browser nicht vorhanden.'};
  const requestedView=params.get('view');
  if(fileKind(d)==='markdown'){
    return {projectId:p.id,docId:d.id,
      view:VIEWS.includes(requestedView)?requestedView:view,
      warning:requestedView&&!VIEWS.includes(requestedView)?'Unbekannte Ansicht im Direktlink – die zuletzt verwendete Ansicht wurde geöffnet.':null};
  }
  const panels=filePanelOptions(d),panel=panels.find(item=>item.id===requestedView);
  return {projectId:p.id,docId:d.id,panel:panel?.id||panels[0]?.id||'file',
    warning:requestedView&&!panel?'Unbekannte Dateiansicht im Direktlink – die Standardansicht wurde geöffnet.':null};
}
function restoreInitialDirectLink(){
  const target=directLinkFromSearch();
  if(!target)return null;
  if(target.error){toast(target.error);return null}
  projectId=target.projectId;
  docId=target.docId;
  if(target.view)setView(target.view);
  if(target.warning)toast(target.warning);
  return target;
}
function updateDirectLinkBreadcrumb(){
  const breadcrumb=$('#breadcrumb'),doc=documentNow();
  const enabled=!!(project()&&doc&&doc.projectId===projectId&&!appSettingsOpen);
  breadcrumb.disabled=!enabled;
  breadcrumb.title=enabled?'Direktlink zu dieser Ansicht kopieren':'Kein Direktlink verfügbar';
  breadcrumb.setAttribute('aria-label',enabled?'Direktlink zur aktuellen Ansicht kopieren: '+workspacePath(doc):'Kein Direktlink verfügbar');
}
async function copyCurrentDirectLink(){
  const link=directLinkUrl();
  if(!link){toast('Kein Direktlink für diese Ansicht verfügbar');return}
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(link);
      toast('Direktlink kopiert');return;
    }
  }catch(error){console.warn('Zwischenablage nicht direkt beschreibbar:',error)}
  // Fallback for non-secure contexts or browsers without the Clipboard API.
  let copied=false,area;
  try{
    area=document.createElement('textarea');
    area.value=link;
    area.readOnly=true;
    area.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(area);
    area.focus();area.select();
    copied=document.execCommand('copy');
  }catch(error){console.warn('Fallback-Kopieren fehlgeschlagen:',error)}
  finally{area?.remove()}
  if(copied){toast('Direktlink kopiert');return}
  // Do not claim a successful copy if browser permissions denied both methods.
  if(typeof window.prompt==='function')window.prompt('Direktlink manuell kopieren:',link);
  else toast('Direktlink konnte nicht kopiert werden');
}
