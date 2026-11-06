'use strict';
// v47: the browser/system Back button is an app-local overlay/navigation action.
// A same-URL guard entry ensures Back dispatches popstate without leaving the app.
let browserBackNavigationInstalled=false;
function browserBackToggleSidebar(){
  const app=$('.app');
  if(window.matchMedia('(max-width:850px)').matches){
    app.classList.remove('back-sidebar-hidden');
    setMobileMenu(!app.classList.contains('menu-open'));
  }else{
    const hidden=app.classList.toggle('back-sidebar-hidden');
    $('#mainSidebar').inert=hidden;
  }
}
function initBrowserBackNavigation(){
  if(browserBackNavigationInstalled)return;
  browserBackNavigationInstalled=true;
  function armBackGuard(){
    try{
      // Preserve state owned by other features rather than overwriting it.
      const previous=history.state;
      const next=previous&&typeof previous==='object'&&!Array.isArray(previous)?{...previous}:{};
      next.__mindfaggBackGuard=true;
      history.pushState(next,'',location.href);
      return true;
    }catch(error){console.warn('Browser-Zurück-Taste konnte nicht eingerichtet werden:',error);return false}
  }
  if(!armBackGuard())return;
  window.addEventListener('popstate',()=>{
    try{
      if(!$('#modalBack').classList.contains('hidden')){
        // Also respects closeModal's active GitHub operation guard.
        closeModal();
      }else{
        closeWorkspaceActionMenu();
        browserBackToggleSidebar();
      }
    }finally{
      // Re-arm after EVERY Back: the next press toggles/closes again.
      armBackGuard();
    }
  });
  window.addEventListener('resize',()=>{
    const app=$('.app');
    if(window.matchMedia('(max-width:850px)').matches&&app.classList.contains('back-sidebar-hidden')){
      app.classList.remove('back-sidebar-hidden');
      setMobileMenu(false);
    }
  });
}
