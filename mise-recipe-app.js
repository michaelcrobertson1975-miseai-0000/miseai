/* Permanent Recipe Studio bridge. Authentication remains enforced by prep-kitchen. */
(() => {
 'use strict';
 const studio=document.getElementById('mise-recipe-studio');
 if(!studio)return;
 let configuredRestaurant=null,configuredAccess=null,loading=null,authModule=null;
 const status=document.getElementById('recipeAppStatus');
 const say=message=>{if(status)status.textContent=message;};
 const config=()=>window.MISE_CONFIG||{};
 const auth=()=>authModule||(authModule=import('./auth.js'));
 const blocked=()=>!!(studio.busy||studio.aiBusy||studio.uncertain||studio.tracking?.uncertain);
 const unchangedRestaurant=()=>{if(config().restaurantId!==configuredRestaurant)throw Error('Restaurant changed. Reconnect Recipe Studio before continuing.');};
 async function accessToken(){
  unchangedRestaurant();const c=config();
  if(typeof c.getAccessToken==='function')return await c.getAccessToken();
  if(c.accessToken||c.access_token)return c.accessToken||c.access_token;
  const client=c.supabase||(await auth()).supabase;
  const {data,error}=await client.auth.getSession();if(error)throw error;
  if(!data.session?.access_token)throw Error('Use the dashboard’s Reconnect with Google, or enter your authorized chef kitchen code.');
  return data.session.access_token;
 }
 async function askAI({message,history,restaurantId}){
  unchangedRestaurant();const c=config();if(restaurantId!==c.restaurantId)throw Error('Restaurant changed.');
  if(!c.apiToken)throw Error('Connect the dashboard’s existing Mise AI access before asking for help.');
  const response=await fetch('https://qhfmywontdwwfapowqpo.supabase.co/functions/v1/miseai-assistant',{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.apiToken},
   body:JSON.stringify({restaurant_id:restaurantId,message,history,viewer_role:studio.data?.actor?.role||'chef',source:'typed'}),signal:AbortSignal.timeout(90000),
  });
  const data=await response.json();if(!response.ok||!data.success||!data.reply)throw Error(data.error||'Mise AI could not answer.');return {reply:data.reply};
 }
 async function connectStudio(){
  const c=config();if(!c.restaurantId){say('Connect your restaurant in the dashboard header to open the permanent recipe book.');return false;}
  const code=document.getElementById('recipeKitchenCode')?.value.trim()||c.kitchenCode||null;
  const identity=code||c.getAccessToken||c.supabase||c.accessToken||c.access_token||'google-session';
  if(configuredRestaurant===c.restaurantId&&configuredAccess===identity&&studio.connected)return true;
  if(blocked()){say('Wait for the current request or retry its interrupted confirmation before reconnecting.');return false;}
  if(configuredRestaurant&&configuredRestaurant!==c.restaurantId&&studio.hasUnsavedChanges()){say('Save or export your drafts before changing restaurants.');return false;}
  configuredRestaurant=c.restaurantId;configuredAccess=identity;
  say('Loading your restaurant’s recipe book…');
  await studio.configure({restaurantId:c.restaurantId,kitchenCode:code,accessToken:undefined,supabase:undefined,
   getAccessToken:code?undefined:accessToken,askAI,embedded:true,onConnect:()=>window.wireConnectOpen?.()});
  if(!studio.connected){say('Recipe access needs a verified owner/chef sign-in or authorized kitchen code. Read the Recipe Studio message below.');return false;}
  say('Your permanent recipe book. Add recipes during onboarding or daily use; there is no completion deadline.');return true;
 }
 async function ensureStudio(){if(loading)return loading;loading=connectStudio();try{return await loading;}catch(error){say(error.message||'Could not open Recipe Studio.');return false;}finally{loading=null;}}
 window.miseRecipeCanNavigate=()=>{if(!blocked())return true;say('Wait for the current recipe request or retry its interrupted confirmation before leaving.');return false;};
 window.miseRecipeCanReset=()=>{if(!window.miseRecipeCanNavigate())return false;return !studio.hasUnsavedChanges()||confirm('This action reloads the app. Save or export recipe drafts and finish the CSV review first. Discard them and continue?');};
 window.rcShow=()=>{if(!window.miseRecipeCanNavigate())return false;window.showTab('recipes');ensureStudio();return true;};
 window.miseRecipeConnect=()=>ensureStudio();
 // The existing uploader forwards parsed CSV/Excel cells into the same Step 5 review queue.
 window.rcImportParsedRows=async(headers,rows)=>{
  if(!await ensureStudio())throw Error('Connect authorized recipe access before importing recipes.');
  if(blocked())throw Error('Finish the current recipe request before importing.');
  if(!headers.some(h=>String(h).trim().toLowerCase()==='recipe_key')){
   const aliases={'recipe name':'recipe_name','name':'recipe_name','station':'station','type':'recipe_type','yield qty':'yield_quantity','yield quantity':'yield_quantity','yield unit':'yield_unit','ingredient':'ingredient_name','amount':'quantity','unit':'unit','source':'ingredient_source','method':'method','notes':'recipe_notes','shelf life':'shelf_life'};
   const mapped=headers.map(h=>aliases[String(h).trim().toLowerCase()]||String(h).trim().toLowerCase());
   const name=mapped.indexOf('recipe_name');if(name<0)throw Error('Recipe sheet needs recipe_key or Recipe Name.');
   headers=['recipe_key',...mapped];rows=rows.map(row=>[String(row[name]??'').trim(),...row]);
   if(!headers.includes('recipe_type')){headers.push('recipe_type');rows=rows.map(row=>[...row,'']);}
  }
  const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  const text=[headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
  const old=studio.csv.id;await studio.importCSV({name:'Recipe sheet from dashboard uploader',size:new Blob([text]).size,text:async()=>text});
  if(studio.csv.id===old)throw Error(studio.shadowRoot.querySelector('#status')?.textContent||'Recipe review was not replaced.');
  window.showTab('recipes');return {recipes:studio.csv.items.length,rows:rows.length};
 };
 // Keep the existing element mounted: ordinary app navigation preserves drafts and the CSV queue.
 const guard=(name,allowSame)=>{const original=window[name];if(typeof original!=='function')return;window[name]=function(...args){if(!allowSame?.(...args)&&!window.miseRecipeCanNavigate())return false;return original.apply(this,args);};};
 guard('showTab',name=>name==='recipes');guard('showWorkspace');guard('showDashboardView');guard('showAudit');
 for(const name of ['wireConnect','wireDisconnect']){const original=window[name];if(typeof original==='function')window[name]=function(...args){args[0]?.preventDefault?.();if(!window.miseRecipeCanReset())return false;return original.apply(this,args);};}
 document.getElementById('wireGoogleReconnect')?.addEventListener('click',event=>{if(!window.miseRecipeCanReset()){event.preventDefault();event.stopImmediatePropagation();}},true);
 const refreshPrep=()=>{window.PREP_RECIPE_BOOK_DIRTY=true;if(typeof window.prepLoad==='function')Promise.resolve(window.prepLoad()).catch(()=>say('Recipe saved. Refresh Prep to load the latest kitchen records.'));};
 studio.addEventListener('mise-recipe-saved',refreshPrep);studio.addEventListener('mise-tracking-saved',refreshPrep);
 document.getElementById('recipeAppConnect')?.addEventListener('click',()=>ensureStudio());
 document.getElementById('recipeAppScaleButton')?.addEventListener('click',async()=>{
  if(blocked())return;if(!studio.draft.prep_item_id||studio.dirty){say('Save the selected recipe before scaling.');return;}
  const scale=Number(document.getElementById('recipeAppScale').value);if(!Number.isFinite(scale)||scale<1||scale>300){say('Scale must be between 1% and 300%.');return;}
  const target=document.getElementById('recipeAppScaleResult');studio.busy=true;studio.refreshButtons();target.replaceChildren();
  try{const data=await studio.request('prep-kitchen?restaurant_id='+encodeURIComponent(config().restaurantId)+'&prep_item_id='+encodeURIComponent(studio.draft.prep_item_id)+'&scale_pct='+encodeURIComponent(scale));
   const output=document.createElement('p');output.textContent=data.scaled_output_quantity+' '+data.unit;target.append(output);
   const list=document.createElement('ul');for(const row of data.scaled_inputs||[]){const li=document.createElement('li');li.textContent=row.name+' · '+row.scaled_quantity+' '+row.unit;list.append(li);}target.append(list);say('Saved recipe scaled by Supabase. No recipe or stock changed.');
  }catch(error){say(error.message);}finally{studio.busy=false;studio.refreshButtons();}
 });
 if(new URLSearchParams(location.search).get('workspace')==='recipes')window.rcShow();
})();
