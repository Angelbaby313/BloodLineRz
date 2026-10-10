require('dotenv').config();
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_NAME = process.env.APPLICATION_STAFF_ROLE || 'Head Administrator';
const VERIFIED_ROLE_NAME = 'BloodLine';
const CFX_SERVER_CODE = (process.env.CFX_SERVER_CODE || '').trim();
if (!TOKEN || !CLIENT_ID) { console.error('Missing DISCORD_TOKEN or CLIENT_ID. Copy .env.example to .env and fill them in.'); process.exit(1); }
const RED = 0xC1121F;
const roleSpecs = [
  { name: '👑 Founder', color: 0xE63946, permissions: [PermissionFlagsBits.Administrator] },
  { name: '💎 Co-Founder', color: 0x9D4EDD, permissions: [] },
  { name: '⚙️ Head Administrator', color: 0xF77F00, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.ViewAuditLog] },
  { name: '🛡️ Administrator', color: 0xE9C46A, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ViewAuditLog] },
  { name: '🔨 Moderator', color: 0x457B9D, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ViewAuditLog] },
  { name: '🎫 Support Team', color: 0x2A9D8F, permissions: [] },
  { name: '📹 Streamer', color: 0xB565D9, permissions: [] },
  { name: '💰 VIP', color: 0xF4A261, permissions: [] },
  { name: '🔫 Gang Leader', color: 0xD00000, permissions: [] },
  { name: VERIFIED_ROLE_NAME, color: 0xA4161A, permissions: [] },
  { name: '👤 Unverified', color: 0x8D99AE, permissions: [] }
];
const layout = [
  { name: '📌 START HERE', channels: [['text','welcome'],['text','announcements'],['text','server-rules'],['text','verify-here'],['text','server-connect'],['text','faq']] },
  { name: '🩸 BLOODLINE COMMUNITY', channels: [['text','general-chat'],['text','media-gallery'],['text','looking-for-rp'],['text','events'],['text','streamers-and-clips'],['text','community-highlights'],['voice','Community Lounge'],['voice','City Radio']] },
  { name: '🔫 GANG RP', channels: [['text','gang-news'],['text','gang-applications'],['text','gang-leader-chat'],['text','turf-and-events'],['voice','Gang Room 1'],['voice','Gang Room 2']] },
  { name: '🏙️ CITY & BUSINESS', channels: [['text','city-updates'],['text','server-status'],['text','business-applications'],['text','player-reports'],['text','bug-reports'],['text','suggestions']] },
  { name: '💎 VIP & CREATORS', channels: [['text','vip-and-donations'],['text','streamer-promotions'],['voice','Streaming Room']] },
  { name: '🛠️ SUPPORT CENTER', channels: [['text','open-a-ticket'],['text','whitelist-applications'],['text','ban-appeals'],['text','support-faq']] },
  { name: '🔒 STAFF HQ', private: true, channels: [['text','staff-chat'],['text','staff-logs'],['text','staff-actions'],['text','staff-meetings'],['text','management-only']] },
  { name: '📨 PRIVATE APPLICATIONS', private: true, channels: [] }
];
const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Create BloodLineRZ roles, categories, channels and panels.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('post-panels').setDescription('Post verification and application panels.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('server-status').setDescription('Check the configured FiveM server status.'),
  new SlashCommandBuilder().setName('bloodline-help').setDescription('Show BloodLineRZ bot commands and instructions.')
].map(c => c.toJSON());
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const slug = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'application';
const roleByName = (guild, name) => guild.roles.cache.find(r => r.name === name);
const channelByName = (guild, name, type) => guild.channels.cache.find(c => c.name === name && (!type || c.type === type));
async function ensureRole(guild, spec) {
  let role = roleByName(guild, spec.name);
  if (!role) role = await guild.roles.create({ name: spec.name, color: spec.color, permissions: spec.permissions, reason: 'BloodLineRZ automated setup' });
  else if (spec.permissions.length) await role.setPermissions(spec.permissions, 'BloodLineRZ role permission sync');
  return role;
}
async function ensureCategory(guild, spec, roles) {
  let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === spec.name);
  let overwrites;
  if (spec.private) overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ...['👑 Founder','💎 Co-Founder','⚙️ Head Administrator','🛡️ Administrator','🎫 Support Team'].map(n => roles.get(n)).filter(Boolean).map(r => ({ id:r.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels] }))
  ];
  else if (spec.name === '📌 START HERE') overwrites = [
    { id:guild.roles.everyone.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory], deny:[PermissionFlagsBits.SendMessages] },
    ...['welcome','verify-here','faq','server-rules','announcements','server-connect'].map(n => channelByName(guild,n,ChannelType.GuildText)).filter(Boolean).map(c=>({id:c.id,allow:[PermissionFlagsBits.SendMessages]}))
  ];
  if (!category) category = await guild.channels.create({ name:spec.name, type:ChannelType.GuildCategory, ...(overwrites ? {permissionOverwrites:overwrites}:{}), reason:'BloodLineRZ automated setup' });
  else if (overwrites) await category.permissionOverwrites.set(overwrites, 'BloodLineRZ category permissions');
  return category;
}
async function ensureTextChannel(guild, name, parent, privateChannel = false) {
  let channel = channelByName(guild,name,ChannelType.GuildText);
  const options = { name, type:ChannelType.GuildText, parent:parent.id, reason:'BloodLineRZ automated setup' };
  if (privateChannel) options.permissionOverwrites = parent.permissionOverwrites.cache.map(o=>({id:o.id,type:o.type,allow:o.allow.bitfield,deny:o.deny.bitfield}));
  if (!channel) channel = await guild.channels.create(options);
  else if (channel.parentId !== parent.id) await channel.setParent(parent.id,{lockPermissions:privateChannel,reason:'BloodLineRZ channel organization'});
  return channel;
}
async function ensureVoiceChannel(guild,name,parent) {
  let channel = channelByName(guild,name,ChannelType.GuildVoice);
  if (!channel) channel = await guild.channels.create({name,type:ChannelType.GuildVoice,parent:parent.id,reason:'BloodLineRZ automated setup'});
  else if (channel.parentId !== parent.id) await channel.setParent(parent.id,{reason:'BloodLineRZ channel organization'});
  return channel;
}
const panels = {
  gang:{channel:'gang-applications',title:'🔫 BloodLineRZ Gang Application',description:'Bring your crew into the city. Tell us about your group, RP style, and activity plan.',button:'Apply for a Gang'},
  business:{channel:'business-applications',title:'🏙️ BloodLineRZ Business Application',description:'Pitch a player-owned business with a concept, roleplay plan, and operating team.',button:'Apply for a Business'},
  vip:{channel:'vip-and-donations',title:'💎 BloodLineRZ VIP & Support',description:'Ask about VIP perks or supporting the city. Benefits and terms must be confirmed by management before payment. Never share payment credentials.',button:'VIP / Donation Inquiry'},
  streamer:{channel:'streamer-promotions',title:'📹 BloodLineRZ Creator Program',description:'Share your channel, schedule, and plan for showcasing BloodLineRZ. Promotion is not guaranteed.',button:'Apply as a Creator'},
  whitelist:{channel:'whitelist-applications',title:'📝 BloodLineRZ Whitelist',description:'Apply to join the city. Answer honestly and wait for staff review.',button:'Apply for Whitelist'}
};
function panelEmbed(panel){return new EmbedBuilder().setColor(RED).setTitle(panel.title).setDescription(panel.description).addFields({name:'How it works',value:'Click below and complete the private form. Only you and authorized staff can view your submission.'}).setFooter({text:'BLOODLINERZ • Your Story. Your Reputation. Your Bloodline.'});}
async function postPanels(guild){
  const posted=[];
  const verify=channelByName(guild,'verify-here',ChannelType.GuildText);
  if(verify){const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('blr_verify').setLabel('Verify & Get BloodLine').setStyle(ButtonStyle.Danger));await verify.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('🩸 Join the BloodLine').setDescription('Click below to verify your Discord membership and receive the **BloodLine** role. By verifying, you agree to follow the server rules.')],components:[row]});posted.push('#verify-here');}
  for(const [kind,p] of Object.entries(panels)){const ch=channelByName(guild,p.channel,ChannelType.GuildText);if(!ch){posted.push(`Missing #${p.channel}`);continue;}const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`blr_apply_${kind}`).setLabel(p.button).setStyle(ButtonStyle.Danger));await ch.send({embeds:[panelEmbed(p)],components:[row]});posted.push(`#${p.channel}`);}
  return posted;
}
async function runSetup(guild){
  const roles=new Map();for(const spec of roleSpecs)roles.set(spec.name,await ensureRole(guild,spec));
  const categories=[];
  for(const spec of layout){const cat=await ensureCategory(guild,spec,roles);categories.push(spec.name);for(const [type,name] of spec.channels){if(type==='voice')await ensureVoiceChannel(guild,name,cat);else await ensureTextChannel(guild,name,cat,!!spec.private);}}
  const welcome=channelByName(guild,'welcome',ChannelType.GuildText);if(welcome&&welcome.messages.cache.size===0)await welcome.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('🩸 WELCOME TO BLOODLINERZ').setDescription('**Welcome to the family.**\n\nYour story. Your reputation. Your bloodline.\n\n1. Read #server-rules.\n2. Click the verification button in #verify-here to receive **BloodLine**.\n3. Check #announcements and #server-connect.\n4. Find your crew and build your name in the city.\n5. Open a ticket if you need help.').setFooter({text:'BloodLineRZ Roleplay'})]});
  const rules=channelByName(guild,'server-rules',ChannelType.GuildText);if(rules&&rules.messages.cache.size===0)await rules.send({embeds:[new EmbedBuilder().setColor(RED).setTitle('🩸 BLOODLINERZ COMMUNITY RULES').setDescription(['**1. Respect everyone.** Harassment, hate speech, and threats are not allowed.','**2. No cheating or exploiting.** Report bugs instead of abusing them.','**3. Keep roleplay disputes in character when possible.** Use tickets for unresolved issues.','**4. Follow the city rules.** Staff may enforce published FiveM rules.','**5. Gang RP must stay within server rules.** Follow rules for turf, initiation, and conflict.','**6. Bring evidence to reports.** Clips or screenshots help staff review fairly.','**7. Protect private information.** Never share passwords, tokens, or payment credentials.','**8. Staff decisions may be appealed.** Use the correct ticket and remain respectful.','**9. No spam or unsolicited advertising.** Use the creator channels.','**10. Management may update rules.** Watch announcements.'].join('\n\n'))]});
  return {categories:categories.length,roles:roles.size,panels:await postPanels(guild)};
}
const formFields={
 gang:[['crew_name','Gang / crew name',true,100],['leader_name','Leader character name',true,100],['member_count','Current member count',true,30],['story','Backstory, goals and RP style',true,400],['plan','Activity, territory and conflict RP plan',true,400]],
 business:[['business_name','Proposed business name',true,100],['owner_name','Owner character name',true,100],['business_type','Business type / location',true,100],['plan','Business concept and RP plan',true,400],['staff','Who will help operate it?',true,300]],
 vip:[['request','What are you asking about?',true,100],['details','Details or questions (no payment credentials)',true,400],['contact','Preferred contact / in-city name',true,100]],
 streamer:[['creator_name','Creator / channel name',true,100],['platform','Platform and channel link',true,200],['schedule','Streaming / upload schedule',true,150],['plan','How will you showcase BloodLineRZ?',true,400],['experience','Recent content or audience details',false,300]],
 whitelist:[['character_name','FiveM character name',true,100],['age','Age (follow server age policy)',true,20],['experience','FiveM RP experience',true,400],['scenario','How would you handle a roleplay scenario?',true,400],['rules','Confirm you will read and follow the rules',true,200]]
};
function buildModal(kind){const p=panels[kind];const modal=new ModalBuilder().setCustomId(`blr_modal_${kind}`).setTitle(p.button);modal.addComponents(...formFields[kind].map(([id,label,required,max])=>new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(max>180?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(required).setMaxLength(max))));return modal;}
function staffRole(guild){return roleByName(guild,STAFF_ROLE_NAME)||roleByName(guild,'⚙️ Head Administrator')||roleByName(guild,'👑 Founder');}
async function createApplicationTicket(interaction,kind){
 const guild=interaction.guild;const category=guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name==='📨 PRIVATE APPLICATIONS');if(!category)return interaction.reply({content:'Application category is missing. Ask an administrator to run `/setup`.',ephemeral:true});
 const existing=guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.parentId===category.id&&c.topic?.includes(`applicant:${interaction.user.id}`));if(existing)return interaction.reply({content:`You already have an open application: ${existing}`,ephemeral:true});
 const sr=staffRole(guild);const channel=await guild.channels.create({name:`${kind}-${slug(interaction.user.username).slice(0,20)}-${interaction.user.id.slice(-4)}`.slice(0,90),type:ChannelType.GuildText,parent:category.id,topic:`BloodLineRZ ${kind} application | applicant:${interaction.user.id} | kind:${kind}`,permissionOverwrites:[{id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:interaction.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]},...(sr?[{id:sr.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages]}]:[])],reason:'BloodLineRZ private application'});
 const p=panels[kind];const embed=new EmbedBuilder().setColor(RED).setTitle(`${p.title} — Submitted`).setDescription(`Applicant: ${interaction.user}\nType: **${kind}**\n\nStaff: use the buttons to approve or reject after reviewing.`);
 for(const [id,label] of formFields[kind])embed.addFields({name:label,value:(interaction.fields.getTextInputValue(id)||'Not provided').slice(0,1024)});
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`blr_decide_approve_${interaction.user.id}_${kind}`).setLabel('Approve').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`blr_decide_reject_${interaction.user.id}_${kind}`).setLabel('Reject').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId(`blr_close_${interaction.user.id}`).setLabel('Close / Transcript').setStyle(ButtonStyle.Secondary));
 await channel.send({content:`${interaction.user}${sr?` <@&${sr.id}>`:''}`,embeds:[embed],components:[row],allowedMentions:{users:[interaction.user.id],roles:sr?[sr.id]:[]}});return interaction.reply({content:`Your application was submitted privately: ${channel}`,ephemeral:true});
}
async function logToStaff(guild,content,embed){const ch=channelByName(guild,'staff-logs',ChannelType.GuildText);if(ch)await ch.send({content,embeds:embed?[embed]:[]}).catch(()=>{});}
async function getFiveMStatus(){if(!CFX_SERVER_CODE)return {configured:false};try{const response=await fetch(`https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(CFX_SERVER_CODE)}`);if(!response.ok)return {configured:true,online:false};const json=await response.json();const d=json?.Data;if(!d)return {configured:true,online:false};return {configured:true,online:true,hostname:d.hostname||'BloodLineRZ',clients:d.clients??'?',maxClients:d.sv_maxclients??'?',endpoint:d.connectEndPoints?.[0]||null};}catch{return {configured:true,online:false};}}
client.once('ready',async()=>{console.log(`Logged in as ${client.user.tag}`);const rest=new REST({version:'10'}).setToken(TOKEN);try{if(GUILD_ID)await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands});else await rest.put(Routes.applicationCommands(CLIENT_ID),{body:commands});console.log(`Registered ${commands.length} slash commands.`);}catch(e){console.error('Slash command registration failed:',e);}});
client.on('interactionCreate',async interaction=>{try{
 if(interaction.isChatInputCommand()){
  if(interaction.commandName==='setup'){if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return interaction.reply({content:'Only administrators can run setup.',ephemeral:true});await interaction.deferReply({ephemeral:true});const r=await runSetup(interaction.guild);return interaction.editReply(`**BloodLineRZ setup complete.**\n• Categories: ${r.categories}\n• Roles checked: ${r.roles}\n• Panels posted: ${r.panels.join(', ')}\n\nThe verified role is **${VERIFIED_ROLE_NAME}**. Review permissions and role order.`);}
  if(interaction.commandName==='post-panels'){if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return interaction.reply({content:'Only administrators can post panels.',ephemeral:true});await interaction.deferReply({ephemeral:true});return interaction.editReply(`Panels posted: ${(await postPanels(interaction.guild)).join(', ')}`);}
  if(interaction.commandName==='server-status'){await interaction.deferReply({ephemeral:true});const s=await getFiveMStatus();if(!s.configured)return interaction.editReply('FiveM status is not configured yet. Set `CFX_SERVER_CODE` in `.env` to the code from your `cfx.re/join/XXXXX` link, restart the bot, and try again.');const e=new EmbedBuilder().setColor(s.online?0x2A9D8F:RED).setTitle('🩸 BloodLineRZ FiveM Status').setDescription(s.online?`**Online**\nPlayers: **${s.clients}/${s.maxClients}**\n${s.endpoint?`Connect address: ${s.endpoint}`:''}`:'**Offline or unreachable**').setTimestamp();return interaction.editReply({embeds:[e]});}
  if(interaction.commandName==='bloodline-help')return interaction.reply({ephemeral:true,content:'**BloodLineRZ Management Bot**\n`/setup` — create roles, channels, and panels.\n`/post-panels` — repost verification and application panels.\n`/server-status` — check the configured FiveM server.\n\nVerification assigns the **BloodLine** role and removes **👤 Unverified** when present. Staff can approve/reject applications or close them to save a transcript in #staff-logs.'});
 }
 if(interaction.isButton()){
  if(interaction.customId==='blr_verify'){const member=interaction.member;const verified=roleByName(interaction.guild,VERIFIED_ROLE_NAME);if(!verified)return interaction.reply({content:'The BloodLine role is missing. Ask an administrator to run `/setup`.',ephemeral:true});if(member.roles.cache.has(verified.id))return interaction.reply({content:'You are already verified and have the BloodLine role. Welcome to the family!',ephemeral:true});await member.roles.add(verified,'Member completed BloodLineRZ Discord verification');const unverified=roleByName(interaction.guild,'👤 Unverified');if(unverified&&member.roles.cache.has(unverified.id))await member.roles.remove(unverified,'Member verified');await logToStaff(interaction.guild,`✅ ${interaction.user.tag} verified and received **BloodLine**.`);return interaction.reply({content:'✅ You are verified! The **BloodLine** role has been added. Welcome to BloodLineRZ.',ephemeral:true});}
  if(interaction.customId.startsWith('blr_apply_')){const kind=interaction.customId.replace('blr_apply_','');if(!formFields[kind])return interaction.reply({content:'That application type is not configured.',ephemeral:true});return interaction.showModal(buildModal(kind));}
  if(interaction.customId.startsWith('blr_decide_')){if(!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)&&!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages))return interaction.reply({content:'Only authorized staff can decide applications.',ephemeral:true});const [, , decision, applicantId, kind]=interaction.customId.split('_');const member=await interaction.guild.members.fetch(applicantId).catch(()=>null);if(decision==='approve'&&member){const roleName={gang:'🔫 Gang Leader',streamer:'📹 Streamer',vip:'💰 VIP',business:null,whitelist:VERIFIED_ROLE_NAME}[kind];const role=roleName?roleByName(interaction.guild,roleName):null;if(role)await member.roles.add(role,`BloodLineRZ ${kind} application approved`);await member.send(`Your **${kind}** application to BloodLineRZ has been approved.${role?` You have been assigned the **${role.name}** role.`:''}`).catch(()=>{});}else if(member)await member.send(`Your **${kind}** application to BloodLineRZ was not approved at this time. Contact staff if you have questions.`).catch(()=>{});await interaction.reply({content:`Application ${decision}d by ${interaction.user}.`,ephemeral:false});await logToStaff(interaction.guild,`Application ${decision}d: ${kind} for <@${applicantId}> by ${interaction.user}.`);return;}
  if(interaction.customId.startsWith('blr_close_')){const applicantId=interaction.customId.replace('blr_close_','');const isStaff=interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)||interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);if(!isStaff&&interaction.user.id!==applicantId)return interaction.reply({content:'Only the applicant or authorized staff can close this application.',ephemeral:true});await interaction.reply({content:'Saving transcript to #staff-logs and closing this channel in 5 seconds.',ephemeral:true});const ch=interaction.channel;const messages=await ch.messages.fetch({limit:100}).catch(()=>null);if(messages){const lines=[...messages.values()].sort((a,b)=>a.createdTimestamp-b.createdTimestamp).map(m=>`[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content||'[embed/attachment]'}`);const transcript=new EmbedBuilder().setColor(RED).setTitle(`Transcript: #${ch.name}`).setDescription(lines.join('\n').slice(0,4000)||'No messages').addFields({name:'Closed by',value:interaction.user.tag},{name:'Channel',value:ch.name}).setTimestamp();await logToStaff(interaction.guild,`📁 Application transcript saved from #${ch.name}.`,transcript);}setTimeout(()=>ch.delete('BloodLineRZ application closed').catch(()=>{}),5000);return;}
 }
 if(interaction.isModalSubmit()&&interaction.customId.startsWith('blr_modal_')){const kind=interaction.customId.replace('blr_modal_','');if(!formFields[kind])return interaction.reply({content:'Unknown application type.',ephemeral:true});return createApplicationTicket(interaction,kind);}
 }catch(err){console.error('Interaction error:',err);if(interaction.isRepliable()&&!interaction.replied&&!interaction.deferred)await interaction.reply({content:'Something went wrong. Check the bot console and required permissions.',ephemeral:true}).catch(()=>{});}});
client.login(TOKEN);
