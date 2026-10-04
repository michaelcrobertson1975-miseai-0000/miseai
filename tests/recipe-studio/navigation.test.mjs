import {Window} from './runtime/node_modules/happy-dom/lib/index.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// Synthetic fixtures only. These quantities are not production recipe specifications.
const w=new Window({url:'https://app.example.test'});
w.eval(fs.readFileSync(new URL('../../mise-recipe-module.js',import.meta.url),'utf8'));
const studio=w.document.createElement('mise-recipe-studio');w.document.body.append(studio);
const $=selector=>studio.shadowRoot.querySelector(selector);
const clone=value=>JSON.parse(JSON.stringify(value));
const checks=[];
const check=async(name,run)=>{await run();checks.push(name);};
let requests=0,prompts=0,allowDiscard=true;
w.fetch=async()=>{requests++;throw new Error('Navigation must not call a backend');};
w.confirm=()=>{prompts++;return allowDiscard;};
const input=(name,id,amount=1)=>({name,stock_kind:'prep',prep_item_id:id,amount,unit:'oz',note:''});
const recipe=(id,name,type,ingredients=[])=>({prep_item_id:id,name,station:'grill',unit:'oz',recipe:{id:'recipe-'+id,prep_item_id:id,name,recipe_type:type,expected_output_quantity:10,expected_output_unit:'oz',expected_input_quantity:type==='raw'?12:null,expected_input_unit:type==='raw'?'oz':null,portion_quantity:null,portion_unit:null,shelf_life:'Chef-defined',notes:'Saved notes',track_trim:type==='raw',is_butchery:type==='raw',ingredients,steps:['Test method'],approved_at:'2026-10-03T20:00:00Z',approved_by:JSON.stringify({role:'chef',id:'test-chef'}),updated_at:'2026-10-03T19:00:00Z'}});
const raw=recipe('raw','Raw filet','raw');
const wash=recipe('wash','Egg wash','batch',[{name:'Egg',stock_kind:'ingredient',ingredient_id:'egg',amount:2,unit:'each',note:''}]);
const filling=recipe('filling','Filling','batch',[input('Egg wash','wash')]);
const dish=recipe('dish','Finished dish','service',[input('Raw filet','raw'),input('Filling','filling'),{name:'Direct pork',stock_kind:'ingredient',ingredient_id:'pork',amount:1,unit:'oz',note:''}]);
studio.config={restaurantId:'test-restaurant'};
studio.data={recipes:[dish,raw,filling,wash],raw_ingredients:[{ingredient_id:'egg',name:'Egg',base_unit:'each'},{ingredient_id:'pork',name:'Direct pork',base_unit:'oz'}],batch_components:[raw,filling,wash].map(row=>({prep_item_id:row.prep_item_id,name:row.name,unit:row.unit})),stations:[{code:'grill',label:'Grill'}],units:[{code:'oz',label:'oz'},{code:'each',label:'each'}]};
studio.openRecipe(dish);

await check('Four accessible views keep the same recipe identity and fields',()=>{
 const before=clone(studio.draft),tabs=[...studio.shadowRoot.querySelectorAll('[role=tab]')];
 assert.deepEqual(tabs.map(tab=>tab.textContent),['Recipe Card','Raw Yield','Batch Tracking','Recipe History']);
 for(const view of ['raw','batch','history','recipe']){
  assert.equal(studio.setView(view),true);assert.deepEqual(clone(studio.draft),before);assert.equal(studio.dirty,false);
  assert.equal(studio.shadowRoot.querySelectorAll('[role=tab][aria-selected=true]').length,1);
  assert.equal(studio.shadowRoot.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);
 }
 assert.equal(requests,0);
});
await check('Keyboard arrows, Home and End select and focus the view',()=>{
 const key=key=>$('#view-tab-'+studio.view).dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 key('ArrowRight');assert.equal(studio.view,'raw');assert.equal(studio.shadowRoot.activeElement.id,'view-tab-raw');
 key('End');assert.equal(studio.view,'history');key('Home');assert.equal(studio.view,'recipe');
 key('ArrowLeft');assert.equal(studio.view,'history');studio.setView('recipe');
});
await check('Views do not invent actual measurements, batches or earlier history',()=>{
 studio.setView('raw');assert.match($('#view-panel-raw').textContent,/Open a linked raw-prep/);
 studio.setView('batch');assert.match($('#view-panel-batch').textContent,/finished dish uses the prepared components/);
 studio.setView('history');assert.match($('#view-panel-history').textContent,/test-chef/);assert.match($('#view-panel-history').textContent,/Load saved changes/);
 studio.setView('recipe');
});
await check('Opening a raw component selects its raw card without writing or prompting',()=>{
 const before=prompts;$('#ingredients [data-open-component="0"]').click();
 assert.equal(studio.draft.prep_item_id,'raw');assert.equal(studio.view,'raw');assert.equal(studio.navigation.length,1);
 assert.equal($('#component-navigation').hidden,false);assert.match($('#return-component').textContent,/Finished dish/);
 assert.match($('#view-panel-raw').textContent,/Load runs/);assert.match($('#view-panel-raw').textContent,/Main output excludes retained trim/);
 assert.equal(prompts,before);assert.equal(requests,0);assert.equal(studio.returnToParent(),true);
});
await check('An unsaved parent, view, preview, search and AI draft survive a component visit',()=>{
 $('#name').value='Local parent name';$('#notes').value='Unsaved parent notes';studio.capture();studio.touch();
 $('#search').value='Finished';$('#prompt').value='Question about this parent';$('#include-recipe').checked=false;
 studio.history=[{role:'user',text:'Parent context'}];$('#preview').click();studio.setView('batch');
 const before=clone(studio.draft);const oldPrompts=prompts;
 assert.equal(studio.openComponent(1),true);assert.equal(studio.view,'batch');assert.equal(studio.history.length,0);
 assert.equal(studio.hasUnsavedChanges(),true);assert.equal(studio.dirty,false);assert.equal(prompts,oldPrompts);
 assert.equal(studio.returnToParent(),true);assert.deepEqual(clone(studio.draft),before);assert.equal(studio.dirty,true);
 assert.equal(studio.view,'batch');assert.equal($('#search').value,'Finished');assert.equal($('#prompt').value,'Question about this parent');
 assert.equal($('#include-recipe').checked,false);assert.equal($('#preview-card').hidden,false);assert.match($('#preview-card').textContent,/Unsaved parent notes/);
 assert.deepEqual(clone(studio.history),[{role:'user',text:'Parent context'}]);
});
await check('Nested batch navigation returns through each parent',()=>{
 assert.equal(studio.openComponent(1),true);assert.equal(studio.openComponent(0),true);
 assert.equal(studio.draft.prep_item_id,'wash');assert.equal(studio.navigation.length,2);
 assert.match($('#navigation-path').textContent,/Local parent name \/ Filling \/ Egg wash/);
 assert.equal(studio.returnToParent(),true);assert.equal(studio.draft.prep_item_id,'filling');assert.equal(studio.view,'batch');
 assert.equal(studio.returnToParent(),true);assert.equal(studio.draft.prep_item_id,'dish');assert.equal(studio.dirty,true);
});
await check('Browser close and restaurant changes protect a suspended parent draft',async()=>{
 studio.openComponent(1);const event=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 await assert.rejects(studio.configure({restaurantId:'other-restaurant'}),/Save or export/);
 assert.equal(studio.navigation.length,1);assert.equal(studio.config.restaurantId,'test-restaurant');studio.returnToParent();
});
await check('Abandoning navigation warns about a suspended parent',()=>{
 studio.openComponent(1);allowDiscard=false;$('#new').click();assert.equal(studio.draft.prep_item_id,'filling');assert.equal(studio.navigation.length,1);
 studio.returnToParent();allowDiscard=true;
});
await check('Unsaved component edits cannot silently replace the parent draft',()=>{
 const before=clone(studio.draft);studio.openComponent(1);studio.setView('recipe');$('#notes').value='Unsaved child';studio.capture();studio.touch();
 allowDiscard=false;assert.equal(studio.returnToParent(),false);assert.equal(studio.draft.recipe.notes,'Unsaved child');
 allowDiscard=true;assert.equal(studio.returnToParent(),true);assert.deepEqual(clone(studio.draft),before);
});
await check('Calculated parent costs survive navigation without recalculation',()=>{
 studio.dirty=false;studio.price={cost_complete:true,total_cost:12.5,cost_per_output:1.25};studio.render();studio.setView('recipe');
 const before=$('#batch-cost').textContent;studio.openComponent(1);studio.returnToParent();
 assert.equal($('#batch-cost').textContent,before);assert.equal(studio.price.total_cost,12.5);assert.equal(requests,0);
});
await check('Direct Food inputs do not receive an invented raw-prep link',()=>{
 studio.setView('recipe');const direct=$('.ingredient[data-index="2"]');assert.equal(direct.querySelector('[data-open-component]'),null);
 assert.match(direct.textContent,/Direct Food input/);assert.equal(studio.openComponent(2),false);assert.equal(studio.draft.prep_item_id,'dish');
});
await check('Missing prepared links stay visible without name matching or writes',()=>{
 studio.draft.recipe.ingredients.push(input('Looks like Filling','missing'));studio.renderIngredients();
 assert.match($('.ingredient[data-index="3"]').textContent,/card unavailable/);assert.equal(studio.openComponent(3),false);assert.equal(requests,0);
 studio.draft.recipe.ingredients.pop();studio.renderIngredients();
});
await check('A cyclic link cannot push an ancestor onto the navigation stack',()=>{
 studio.openComponent(1);studio.draft.recipe.ingredients.push(input('Finished dish','dish'));
 assert.equal(studio.openComponent(1),false);assert.equal(studio.navigation.length,1);assert.match($('#status').textContent,/links back/);studio.returnToParent();
});
await check('Busy and interrupted-save states block tabs and component navigation',()=>{
 studio.busy=true;studio.refreshButtons();assert.equal($('#view-tab-raw').disabled,true);assert.equal(studio.setView('raw'),false);assert.equal(studio.openComponent(1),false);
 studio.busy=false;studio.uncertain=true;studio.refreshButtons();assert.equal(studio.openComponent(0),false);assert.equal(studio.setView('history'),false);
 studio.uncertain=false;studio.refreshButtons();
});
await check('History shows saved details separately from unsaved draft edits',()=>{
 studio.setView('recipe');$('#name').value='Unsaved renamed dish';studio.capture();studio.touch();studio.setView('history');
 const text=$('#view-panel-history').textContent;assert.match(text,/unsaved changes/);assert.match(text,/Saved recipe nameFinished dish/);assert.match(text,/recipe-dish/);
});
await check('Unsafe names, notes and actor labels are escaped in new views',()=>{
 studio.draft.name='<img src=x onerror=alert(1)>';studio.draft.recipe.ingredients[0].name='<script>bad</script>';
 const saved=studio.data.recipes[0].recipe.approved_by;studio.data.recipes[0].recipe.approved_by='<img src=x>';
 for(const view of ['raw','batch','history']){const html=studio.viewCard(view);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;img/);}
 studio.data.recipes[0].recipe.approved_by=saved;studio.openRecipe(dish);
});
await check('New recipe resets navigation and selects Recipe Card',()=>{
 studio.openComponent(1);$('#new').click();assert.equal(studio.view,'recipe');assert.equal(studio.navigation.length,0);assert.equal(studio.draft.prep_item_id,undefined);
});
await check('Step 2 navigation made no requests and persisted no credentials',()=>{
 assert.equal(requests,0);assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
});
console.log(JSON.stringify({passed:checks.length,checks},null,2));
await w.happyDOM.abort();
