// Static source inspection only. Never imports/executes the reference bot or reads its environment.
const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.argv[2];if(!root)throw Error('Pass the read-only Wayfinder source root');
const omitted=new Set(['fieldName.ts','medal.ts','runecloak.ts','types.ts']);
const types={String:3,Integer:4,Boolean:5,User:6,Channel:7,Role:8,Number:10,Attachment:11};
const inventory=[];
for(const file of fs.readdirSync(path.join(root,'src/commands')).filter(f=>f.endsWith('.ts')&&!omitted.has(f))){
 const source=fs.readFileSync(path.join(root,'src/commands',file),'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 const funcs=new Map();sf.forEachChild(n=>{if(ts.isFunctionDeclaration(n)&&n.name)funcs.set(n.name.text,n);});
 function literal(n){if(!n)return undefined;if(ts.isStringLiteral(n)||ts.isNumericLiteral(n))return ts.isNumericLiteral(n)?Number(n.text):n.text;if(n.kind===ts.SyntaxKind.TrueKeyword)return true;if(n.kind===ts.SyntaxKind.FalseKeyword)return false;if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(sf),literal(p.initializer)]));return {expression:n.getText(sf)};}
 function callback(n,type){if(ts.isIdentifier(n))n=funcs.get(n.text);const out={type};if(!n)return {...out,unresolved:true};const body=n.body;if(ts.isBlock(body)){for(const stmt of body.statements){if(ts.isExpressionStatement(stmt))chain(stmt.expression,out);if(ts.isReturnStatement(stmt)&&stmt.expression)chain(stmt.expression,out);}}else chain(body,out);return out;}
 function chain(n,out){if(!n||!ts.isCallExpression(n)||!ts.isPropertyAccessExpression(n.expression))return;const method=n.expression.name.text;chain(n.expression.expression,out);const args=n.arguments;
  if(method==='addSubcommand'){(out.options??=[]).push(callback(args[0],1));return;}
  const kind=/^add(\w+)Option$/.exec(method);if(kind){(out.options??=[]).push(callback(args[0],types[kind[1]]));return;}
  const names={setName:'name',setDescription:'description',setRequired:'required',setAutocomplete:'autocomplete',setMinValue:'min_value',setMaxValue:'max_value',setMinLength:'min_length',setMaxLength:'max_length',setDefaultMemberPermissions:'default_member_permissions'};
  if(names[method])out[names[method]]=literal(args[0]);if(method==='addChoices')out.choices=args.map(literal);if(method==='addChannelTypes')out.channel_types=args.map(literal);
 }
 let builder;
 function find(n){if(ts.isPropertyAssignment(n)&&n.name.getText(sf)==='data'&&!ts.isIdentifier(n.initializer)){builder={};chain(n.initializer,builder);}
 if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='builder'){builder={};chain(n.initializer,builder);}ts.forEachChild(n,find);}
 find(sf);
 const services=[...source.matchAll(/from "\.\.\/services\/([^"]+)"/g)].map(m=>m[1]);
 inventory.push({file:'src/commands/'+file,...builder,services,hasAutocomplete:/async autocomplete\(/.test(source)});
}
fs.mkdirSync('test/fixtures',{recursive:true});fs.writeFileSync('test/fixtures/wayfinder-command-contracts.json',JSON.stringify({source:'lcbmann/keizaal-wayfinder',revision:'1bf76065ffa323838bd71c4657dced65a4923415',commands:inventory},null,2)+'\n');
for(const c of inventory)console.log(c.file+': '+(c.options??[]).map(s=>s.name+'('+ (s.options??[]).map(o=>`${o.name}:${o.type}${o.required?'!':''}${o.autocomplete?'~':''}`).join(',')+')').join(' | '));
