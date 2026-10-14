require('dotenv').config();
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, OverwriteType
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
  { name: '🛠️ SUPPORT CENTER', channels: [['text','open-a-ticket'],['text','staff-applications'],['text','whitelist-applications'],['text','ban-appeals'],['text','support-faq']] },
  { name: '🔒 STAFF HQ', private: true, channels: [['text','staff-chat'],['text','staff-logs'],['text','staff-actions'],['text','staff-meetings'],['text','management-only']] },
  { name: '📨 PRIVATE APPLICATIONS', private: true, channels: [] }
];
const commands = [
  new SlashCommandBuilder().setName('server-restarted').setDescription('Ping BloodLine and announce the server is ready to fly in.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('update-server').setDescription('Update the welcome and staff application panel.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('setup').setDescription('Create BloodLineRZ roles, categories, channels and panels.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('post-panels').setDescription('Post verification and application panels.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('ticket-panel').setDescription('Post or update the support panel in open-a-ticket.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('server-status').setDescription('Check the configured FiveM server status.'),
  new SlashCommandBuilder().setName('bloodline-help').setDescription('Show BloodLineRZ bot commands and instructions.')
].map(c => c.toJSON());
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });
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
    // Permission overwrites must target roles or members, never channel IDs.
    { id:client.user.id, type:OverwriteType.Member, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.EmbedLinks,PermissionFlagsBits.AttachFiles] }
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
  await postTicketPanel(guild); posted.push('#open-a-ticket');
  await postStaffPanel(guild); posted.push('#staff-applications');
  await postReportPanels(guild); await ensureRestartChannel(guild); posted.push('#player-reports', '#bug-reports', '#server-restarts');
  return posted;
}
async function runSetup(guild){
  await guild.roles.fetch();
  await guild.channels.fetch();
  const roles=new Map();for(const spec of roleSpecs)roles.set(spec.name,await ensureRole(guild,spec));
  const categories=[];
  for(const spec of layout){const cat=await ensureCategory(guild,spec,roles);categories.push(spec.name);for(const [type,name] of spec.channels){if(type==='voice')await ensureVoiceChannel(guild,name,cat);else await ensureTextChannel(guild,name,cat,!!spec.private);}}
  await postWelcome(guild);
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
 const guild=interaction.guild;const category=guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name==='📨 PRIVATE APPLICATIONS');if(!category)return await interaction.reply({content:'Application category is missing. Ask an administrator to run `/setup`.',ephemeral:true});
 const existing=guild.channels.cache.find(c=>c.type===ChannelType.GuildText&&c.parentId===category.id&&c.topic?.includes(`applicant:${interaction.user.id}`));if(existing)return await interaction.reply({content:`You already have an open application: ${existing}`,ephemeral:true});
 const sr=staffRole(guild);const channel=await guild.channels.create({name:`${kind}-${slug(interaction.user.username).slice(0,20)}-${interaction.user.id.slice(-4)}`.slice(0,90),type:ChannelType.GuildText,parent:category.id,topic:`BloodLineRZ ${kind} application | applicant:${interaction.user.id} | kind:${kind}`,permissionOverwrites:[{id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:interaction.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]},...(sr?[{id:sr.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages]}]:[])],reason:'BloodLineRZ private application'});
 const p=panels[kind];const embed=new EmbedBuilder().setColor(RED).setTitle(`${p.title} — Submitted`).setDescription(`Applicant: ${interaction.user}\nType: **${kind}**\n\nStaff: use the buttons to approve or reject after reviewing.`);
 for(const [id,label] of formFields[kind])embed.addFields({name:label,value:(interaction.fields.getTextInputValue(id)||'Not provided').slice(0,1024)});
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`blr_decide_approve_${interaction.user.id}_${kind}`).setLabel('Approve').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`blr_decide_reject_${interaction.user.id}_${kind}`).setLabel('Reject').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId(`blr_close_${interaction.user.id}`).setLabel('Close / Transcript').setStyle(ButtonStyle.Secondary));
 await channel.send({content:`${interaction.user}${sr?` <@&${sr.id}>`:''}`,embeds:[embed],components:[row],allowedMentions:{users:[interaction.user.id],roles:sr?[sr.id]:[]}});return await interaction.reply({content:`Your application was submitted privately: ${channel}`,ephemeral:true});
}
async function logToStaff(guild,content,embed){const ch=channelByName(guild,'staff-logs',ChannelType.GuildText);if(ch)await ch.send({content,embeds:embed?[embed]:[]}).catch(()=>{});}
async function getFiveMStatus(){if(!CFX_SERVER_CODE)return {configured:false};try{const response=await fetch(`https://servers-frontend.fivem.net/api/servers/single/${encodeURIComponent(CFX_SERVER_CODE)}`);if(!response.ok)return {configured:true,online:false};const json=await response.json();const d=json?.Data;if(!d)return {configured:true,online:false};return {configured:true,online:true,hostname:d.hostname||'BloodLineRZ',clients:d.clients??'?',maxClients:d.sv_maxclients??'?',endpoint:d.connectEndPoints?.[0]||null};}catch{return {configured:true,online:false};}}
client.once('clientReady',async()=>{console.log(`Logged in as ${client.user.tag}`);const rest=new REST({version:'10'}).setToken(TOKEN);try{if(GUILD_ID)await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands});else await rest.put(Routes.applicationCommands(CLIENT_ID),{body:commands});console.log(`Registered ${commands.length} slash commands.`);}catch(e){console.error('Slash command registration failed:',e);}});
// General support tickets. Channel topics persist ownership across restarts.
const ticketLocks = new Set();
const closingTickets = new Set();
function supportRoles(guild) {
  const names = new Set([STAFF_ROLE_NAME, '⚙️ Head Administrator', '🛡️ Administrator', '🔨 Moderator', '🎫 Support Team', '👑 Founder', '💎 Co-Founder']);
  return [...guild.roles.cache.values()].filter(r => names.has(r.name));
}
function ticketOwner(channel) {
  return channel?.topic?.match(/^BloodLineRZ (?:support|staff|player-report|bug-report) \| owner:(\d+)$/)?.[1];
}
function ticketStaff(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || supportRoles(interaction.guild).some(r => interaction.member.roles.cache.has(r.id));
}
async function postTicketPanel(guild) {
  const channel = channelByName(guild, 'open-a-ticket', ChannelType.GuildText);
  if (!channel) throw new Error('Missing #open-a-ticket. Create that text channel first.');
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('blr_ticket_open').setLabel('Open a Ticket').setEmoji('🎫').setStyle(ButtonStyle.Danger), reportButton('player'), reportButton('bug'));
  const payload = { embeds: [new EmbedBuilder().setColor(RED).setTitle('🎫 BloodLineRZ Support').setDescription('Need help with the city, a player report, a bug, or an appeal? Click below to open a private ticket with our staff.\n\nExplain the issue and include any relevant screenshots or clips. Please allow staff time to respond.').setFooter({text:'BLOODLINERZ • Support Center'})], components: [row] };
  const recent = await channel.messages.fetch({limit:100});
  const existing = recent.find(m => m.author.id === client.user.id && m.components.some(r => r.components.some(b => b.customId === 'blr_ticket_open')));
  if (existing) await existing.edit(payload); else await channel.send(payload);
  return channel;
}
async function openSupportTicket(interaction, kind = 'support') {
  await interaction.deferReply({ephemeral:true});
  const guild = interaction.guild;
  const key = `${guild.id}:${interaction.user.id}:${kind}`;
  if (ticketLocks.has(key)) return await interaction.editReply('Your ticket is being created. Please wait.');
  ticketLocks.add(key);
  try {
    await guild.channels.fetch();
    await guild.roles.fetch();
    const existing = guild.channels.cache.find(c => ticketOwner(c) === interaction.user.id && c.topic.startsWith(`BloodLineRZ ${kind} |`));
    if (existing) return await interaction.editReply(`You already have an open ticket: ${existing}`);
    let category = channelByName(guild, '🎫 PRIVATE TICKETS', ChannelType.GuildCategory);
    if (!category) {
      // Concurrent first tickets must share a single category creation request.
      if (!ticketCategories.has(guild.id)) ticketCategories.set(guild.id, guild.channels.create({name:'🎫 PRIVATE TICKETS', type:ChannelType.GuildCategory, permissionOverwrites:[{id:guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ManageChannels]}]}).finally(() => ticketCategories.delete(guild.id)));
      category = await ticketCategories.get(guild.id);
    }
    const access = [PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks];
    const roles = kind === 'staff' ? applicationReviewers(guild) : supportRoles(guild);
    const channel = await guild.channels.create({name:`${kind === 'staff' ? 'staff-app' : 'ticket'}-${slug(interaction.user.username).slice(0,20)}-${interaction.user.id.slice(-6)}`,type:ChannelType.GuildText,parent:category.id,topic:`BloodLineRZ ${kind} | owner:${interaction.user.id}`,permissionOverwrites:[{id:guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:interaction.user.id,allow:access},{id:client.user.id,allow:[...access,PermissionFlagsBits.ManageChannels]},...roles.map(r => ({id:r.id,allow:access}))],reason:'BloodLineRZ private support ticket'});
    try {
      await channel.send({content:`<@${interaction.user.id}>${roles.map(r => ` <@&${r.id}>`).join('')}`,allowedMentions:{users:[interaction.user.id],roles:roles.map(r => r.id)},embeds:[new EmbedBuilder().setColor(RED).setTitle(kind === 'staff' ? '🛡️ Staff Application' : kind === 'player-report' ? '🚨 Player Report' : kind === 'bug-report' ? '🐛 Bug Report' : '🎫 Your support ticket is open').setDescription(kind === 'staff' ? 'Thanks for your interest in joining the BloodLineRZ staff! Answer the questions below in this ticket:\n\n**1.** What is your name, age, and in-city name?\n**2.** What time zone are you in, and when are you available?\n**3.** What Red Zone or Discord staff experience do you have?\n**4.** Why do you want to join our staff, and what can you contribute?\n**5.** How would you handle a player report involving your friend?\n\nManagement will review your answers here. Please allow time for a response.' : kind === 'player-report' ? 'Please answer here:\n\n**1.** Your in-game name and ID\n**2.** Reported player’s name and ID (if known)\n**3.** Date and time of the incident\n**4.** What happened and which rule was broken?\n**5.** Attach screenshots or clips as evidence.\n\nStaff will review your report privately.' : kind === 'bug-report' ? 'Please answer here:\n\n**1.** What bug did you encounter?\n**2.** Where and when did it happen?\n**3.** Steps to reproduce it\n**4.** What did you expect, and what happened instead?\n**5.** Attach screenshots, clips, or error messages.\n\nDo not include passwords or tokens. Staff will review your report privately.' : 'Please describe what you need help with. Include character names, dates, and screenshots or clips when relevant.\n\nYou or support staff can close this ticket using the button below.')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('blr_ticket_close').setLabel('Close Ticket / Save Transcript').setStyle(ButtonStyle.Secondary))]});
    } catch (error) { await channel.delete('Ticket opening message failed').catch(() => {}); throw error; }
    return await interaction.editReply(`Your private ticket is ready: ${channel}`);
  } finally { ticketLocks.delete(key); }
}
const ticketCategories = new Map();
async function closeSupportTicket(interaction) {
  const channel = interaction.channel;
  const owner = ticketOwner(channel);
  const canReview = channel.topic?.startsWith('BloodLineRZ staff |') ? interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || applicationReviewers(interaction.guild).some(r => interaction.member.roles.cache.has(r.id)) : ticketStaff(interaction);
  if (!owner || (interaction.user.id !== owner && !canReview)) return await interaction.reply({content:'Only the ticket owner or support staff can close this ticket.',ephemeral:true});
  await interaction.deferReply({ephemeral:true});
  if (closingTickets.has(channel.id)) return await interaction.editReply('This ticket is already being closed.');
  closingTickets.add(channel.id);
  try {
    const logs = channelByName(interaction.guild, 'staff-logs', ChannelType.GuildText);
    if (!logs || logs.id === channel.id) return await interaction.editReply('The #staff-logs channel is missing. Staff must restore it before this ticket can be closed.');
    const messages = [];
    let before;
    while (true) {
      const batch = await channel.messages.fetch({limit:100,...(before ? {before} : {})});
      if (!batch.size) break;
      messages.push(...batch.values());
      before = batch.last().id;
    }
    const lines = [`BloodLineRZ support transcript: #${channel.name}`,`Ticket owner: ${owner}`,`Closed by: ${interaction.user.tag} (${interaction.user.id})`,`Saved at: ${new Date().toISOString()}`,''];
    for (const m of messages.sort((a,b) => a.createdTimestamp-b.createdTimestamp)) {
      lines.push(`[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag} (${m.author.id}): ${m.content || ''}`);
      for (const e of m.embeds) { if(e.title) lines.push(e.title); if(e.description) lines.push(e.description); for(const f of e.fields || []) lines.push(`${f.name}: ${f.value}`); }
      for (const a of m.attachments.values()) lines.push(`Attachment: ${a.name} ${a.url}`);
      lines.push('');
    }
    // Split large transcripts to stay below Discord's attachment limit.
    const parts = []; let part = ''; let size = 0;
    for (const line of lines) { const bytes = Buffer.byteLength(line+'\n'); if(size+bytes>7_000_000 && part) {parts.push(part);part='';size=0;} part += line+'\n';size+=bytes; }
    if(part) parts.push(part);
    for(let i=0;i<parts.length;i++) await logs.send({content:`📁 Support transcript: #${channel.name} | Owner: ${owner} | Closed by: ${interaction.user.tag} | Part ${i+1}/${parts.length}`,allowedMentions:{parse:[]},files:[{attachment:Buffer.from(parts[i],'utf8'),name:`ticket-${channel.id}-${i+1}.txt`}]});
    await interaction.editReply('Transcript saved to #staff-logs. Closing this ticket.');
    await channel.delete(`Support ticket closed by ${interaction.user.tag}`);
  } finally { closingTickets.delete(channel.id); }
}

client.on('interactionCreate',async interaction=>{try{
 if (!interaction.guild) return;
 if(interaction.isChatInputCommand()){
  if(interaction.commandName==='server-restarted'){if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return await interaction.reply({content:'Only administrators can announce a restart.',ephemeral:true});await interaction.deferReply({ephemeral:true});const ch=await announceRestart(interaction.guild);return await interaction.editReply(`Restart announcement sent in ${ch}.`);}
  if(interaction.commandName==='update-server'){if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return await interaction.reply({content:'Only administrators can update the server.',ephemeral:true});await interaction.deferReply({ephemeral:true});await postWelcome(interaction.guild);const ch=await postStaffPanel(interaction.guild);await postTicketPanel(interaction.guild);await postReportPanels(interaction.guild);await ensureRestartChannel(interaction.guild);return await interaction.editReply(`Welcome updated. Staff application panel ready in ${ch}. Player and bug report buttons updated; #server-restarts is ready. Use /server-restarted once FiveM is back up.`);}
  if(interaction.commandName==='ticket-panel'){if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return await interaction.reply({content:'Only administrators can post the ticket panel.',ephemeral:true});await interaction.deferReply({ephemeral:true});const ch=await postTicketPanel(interaction.guild);return await interaction.editReply(`Support ticket panel ready in ${ch}.`);}
  if(interaction.commandName==='setup'){if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return await interaction.reply({content:'Only administrators can run setup.',ephemeral:true});await interaction.deferReply({ephemeral:true});const r=await runSetup(interaction.guild);return await interaction.editReply(`**BloodLineRZ setup complete.**\n• Categories: ${r.categories}\n• Roles checked: ${r.roles}\n• Panels posted: ${r.panels.join(', ')}\n\nThe verified role is **${VERIFIED_ROLE_NAME}**. Review permissions and role order.`);}
  if(interaction.commandName==='post-panels'){if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return await interaction.reply({content:'Only administrators can post panels.',ephemeral:true});await interaction.deferReply({ephemeral:true});return await interaction.editReply(`Panels posted: ${(await postPanels(interaction.guild)).join(', ')}`);}
  if(interaction.commandName==='server-status'){await interaction.deferReply({ephemeral:true});const s=await getFiveMStatus();if(!s.configured)return await interaction.editReply('FiveM status is not configured yet. Set `CFX_SERVER_CODE` in `.env` to the code from your `cfx.re/join/XXXXX` link, restart the bot, and try again.');const e=new EmbedBuilder().setColor(s.online?0x2A9D8F:RED).setTitle('🩸 BloodLineRZ FiveM Status').setDescription(s.online?`**Online**\nPlayers: **${s.clients}/${s.maxClients}**\n${s.endpoint?`Connect address: ${s.endpoint}`:''}`:'**Offline or unreachable**').setTimestamp();return await interaction.editReply({embeds:[e]});}
  if(interaction.commandName==='bloodline-help')return await interaction.reply({ephemeral:true,content:'**BloodLineRZ Management Bot**\n`/server-restarted` — ping BloodLine in #server-restarts after FiveM is back up.\n`/update-server` — update welcome, staff applications, and report buttons.\n`/setup` — create roles, channels, and panels.\n`/post-panels` — repost verification, application, and support panels.\n`/ticket-panel` — post or update the support ticket panel in #open-a-ticket.\nSupport tickets are private to their owner and support staff. Close Ticket saves a text transcript in #staff-logs before deleting the channel.\n`/server-status` — check the configured FiveM server.\n\nVerification assigns the **BloodLine** role and removes **👤 Unverified** when present. Staff can approve/reject applications or close them to save a transcript in #staff-logs.'});
 }
 if(interaction.isButton()){
  if(interaction.customId==='blr_report_player') return await openSupportTicket(interaction, 'player-report');
  if(interaction.customId==='blr_report_bug') return await openSupportTicket(interaction, 'bug-report');
  if(interaction.customId==='blr_staff_open') return await openSupportTicket(interaction, 'staff');
  if(interaction.customId==='blr_ticket_open') return await openSupportTicket(interaction);
  if(interaction.customId==='blr_ticket_close') return await closeSupportTicket(interaction);
  if(interaction.customId==='blr_verify'){const member=interaction.member;const verified=roleByName(interaction.guild,VERIFIED_ROLE_NAME);if(!verified)return await interaction.reply({content:'The BloodLine role is missing. Ask an administrator to run `/setup`.',ephemeral:true});if(member.roles.cache.has(verified.id))return await interaction.reply({content:'You are already verified and have the BloodLine role. Welcome to the family!',ephemeral:true});await member.roles.add(verified,'Member completed BloodLineRZ Discord verification');const unverified=roleByName(interaction.guild,'👤 Unverified');if(unverified&&member.roles.cache.has(unverified.id))await member.roles.remove(unverified,'Member verified');await logToStaff(interaction.guild,`✅ ${interaction.user.tag} verified and received **BloodLine**.`);return await interaction.reply({content:'✅ You are verified! The **BloodLine** role has been added. Welcome to BloodLineRZ.',ephemeral:true});}
  if(interaction.customId.startsWith('blr_apply_')){const kind=interaction.customId.replace('blr_apply_','');if(!formFields[kind])return await interaction.reply({content:'That application type is not configured.',ephemeral:true});return await interaction.showModal(buildModal(kind));}
  if(interaction.customId.startsWith('blr_decide_')){if(!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)&&!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages))return await interaction.reply({content:'Only authorized staff can decide applications.',ephemeral:true});const [, , decision, applicantId, kind]=interaction.customId.split('_');const member=await interaction.guild.members.fetch(applicantId).catch(()=>null);if(decision==='approve'&&member){const roleName={gang:'🔫 Gang Leader',streamer:'📹 Streamer',vip:'💰 VIP',business:null,whitelist:VERIFIED_ROLE_NAME}[kind];const role=roleName?roleByName(interaction.guild,roleName):null;if(role)await member.roles.add(role,`BloodLineRZ ${kind} application approved`);await member.send(`Your **${kind}** application to BloodLineRZ has been approved.${role?` You have been assigned the **${role.name}** role.`:''}`).catch(()=>{});}else if(member)await member.send(`Your **${kind}** application to BloodLineRZ was not approved at this time. Contact staff if you have questions.`).catch(()=>{});await interaction.reply({content:`Application ${decision}d by ${interaction.user}.`,ephemeral:false});await logToStaff(interaction.guild,`Application ${decision}d: ${kind} for <@${applicantId}> by ${interaction.user}.`);return;}
  if(interaction.customId.startsWith('blr_close_')){const applicantId=interaction.customId.replace('blr_close_','');const isStaff=interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)||interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);if(!isStaff&&interaction.user.id!==applicantId)return await interaction.reply({content:'Only the applicant or authorized staff can close this application.',ephemeral:true});await interaction.reply({content:'Saving transcript to #staff-logs and closing this channel in 5 seconds.',ephemeral:true});const ch=interaction.channel;const messages=await ch.messages.fetch({limit:100}).catch(()=>null);if(messages){const lines=[...messages.values()].sort((a,b)=>a.createdTimestamp-b.createdTimestamp).map(m=>`[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content||'[embed/attachment]'}`);const transcript=new EmbedBuilder().setColor(RED).setTitle(`Transcript: #${ch.name}`).setDescription(lines.join('\n').slice(0,4000)||'No messages').addFields({name:'Closed by',value:interaction.user.tag},{name:'Channel',value:ch.name}).setTimestamp();await logToStaff(interaction.guild,`📁 Application transcript saved from #${ch.name}.`,transcript);}setTimeout(()=>ch.delete('BloodLineRZ application closed').catch(()=>{}),5000);return;}
 }
 if(interaction.isModalSubmit()&&interaction.customId.startsWith('blr_modal_')){const kind=interaction.customId.replace('blr_modal_','');if(!formFields[kind])return await interaction.reply({content:'Unknown application type.',ephemeral:true});return await createApplicationTicket(interaction,kind);}
 }catch(err){console.error('Interaction error:',err);if(interaction.isRepliable()){const content='Something went wrong. Check the bot console and required permissions. If closing a ticket failed, its channel has been kept available.';if(interaction.deferred)await interaction.editReply({content}).catch(()=>{});else if(!interaction.replied)await interaction.reply({content,ephemeral:true}).catch(()=>{});else await interaction.followUp({content,ephemeral:true}).catch(()=>{});}}});

function verificationChannel(guild) {
  return channelByName(guild, 'verify', ChannelType.GuildText) || channelByName(guild, 'verify-here', ChannelType.GuildText);
}
function welcomeEmbed(guild) {
  const verify = verificationChannel(guild);
  return new EmbedBuilder().setColor(RED).setTitle('🩸 WELCOME TO BLOODLINERZ! 🩸')
    .setDescription(`**Welcome to BloodLine RZ!** 🩸🔥\n\nHead to ${verify || '#verify'}, verify to get your **BloodLine role**, and fly in! ✈️\n\n**Who really got motion?** 👀💥`);
}
async function postWelcome(guild) {
  await guild.channels.fetch();
  const channel = channelByName(guild, 'welcome', ChannelType.GuildText);
  if (!channel) throw new Error('Create #welcome before running /update-server.');
  const recent = await channel.messages.fetch({limit:100});
  const existing = recent.find(m => m.author.id === client.user.id && !m.mentions.users.size && m.embeds.some(e => e.title?.includes('WELCOME TO BLOODLINERZ')));
  const payload = {embeds:[welcomeEmbed(guild)]};
  if (existing) await existing.edit(payload); else await channel.send(payload);
}
function applicationReviewers(guild) {
  const names = new Set([STAFF_ROLE_NAME, '👑 Founder', '💎 Co-Founder', '⚙️ Head Administrator']);
  return [...guild.roles.cache.values()].filter(r => names.has(r.name));
}
async function postStaffPanel(guild) {
  await guild.channels.fetch();
  const parent = channelByName(guild, '🛠️ SUPPORT CENTER', ChannelType.GuildCategory);
  let channel = channelByName(guild, 'staff-applications', ChannelType.GuildText);
  if (!channel) channel = await guild.channels.create({name:'staff-applications',type:ChannelType.GuildText,...(parent ? {parent:parent.id} : {}),permissionOverwrites:[{id:guild.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory],deny:[PermissionFlagsBits.SendMessages]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}]});
  const payload = {embeds:[new EmbedBuilder().setColor(RED).setTitle('🛡️ Join the BloodLineRZ Staff').setDescription('Ready to help the city grow? We are looking for active, fair, and dependable people to join our staff.\n\nClick **Apply for Staff** to open a private application ticket. Answer the questions inside and wait for management to review.')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('blr_staff_open').setLabel('Apply for Staff').setStyle(ButtonStyle.Danger))]};
  const recent = await channel.messages.fetch({limit:100});
  const existing = recent.find(m => m.author.id === client.user.id && m.components.some(r => r.components.some(b => b.customId === 'blr_staff_open')));
  if (existing) await existing.edit(payload); else await channel.send(payload);
  return channel;
}
client.on('guildMemberAdd', async member => {
  try {
    if (GUILD_ID && member.guild.id !== GUILD_ID) return;
    await member.guild.channels.fetch();
    const channel = channelByName(member.guild, 'welcome', ChannelType.GuildText);
    if (channel) await channel.send({content:`Welcome, <@${member.id}>!`,embeds:[welcomeEmbed(member.guild)],allowedMentions:{users:[member.id]}});
  } catch (error) { console.error('Welcome message failed:', error); }
});


function reportButton(kind) {
  return new ButtonBuilder().setCustomId(kind === 'player' ? 'blr_report_player' : 'blr_report_bug').setLabel(kind === 'player' ? 'Player Report' : 'Bug Report').setEmoji(kind === 'player' ? '🚨' : '🐛').setStyle(ButtonStyle.Danger);
}
async function postReportPanels(guild) {
  await guild.channels.fetch();
  for (const kind of ['player', 'bug']) {
    const name = kind === 'player' ? 'player-reports' : 'bug-reports';
    let channel = channelByName(guild, name, ChannelType.GuildText);
    if (!channel) {
      const parent = channelByName(guild, '🛠️ SUPPORT CENTER', ChannelType.GuildCategory);
      channel = await guild.channels.create({name, type:ChannelType.GuildText, ...(parent ? {parent:parent.id} : {}), permissionOverwrites:[{id:guild.id,type:OverwriteType.Role,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory],deny:[PermissionFlagsBits.SendMessages]},{id:client.user.id,type:OverwriteType.Member,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.EmbedLinks]}]});
    }
    const button = reportButton(kind);
    const payload = {embeds:[new EmbedBuilder().setColor(RED).setTitle(kind === 'player' ? '🚨 Report a Player' : '🐛 Report a Bug').setDescription('Click below to open a private report ticket. Share the details and any screenshots or clips inside. Only you and authorized staff can view the ticket.')],components:[new ActionRowBuilder().addComponents(button)]};
    const recent = await channel.messages.fetch({limit:100});
    const id = kind === 'player' ? 'blr_report_player' : 'blr_report_bug';
    const existing = recent.find(m => m.author.id === client.user.id && m.components.some(r => r.components.some(b => b.customId === id)));
    if (existing) await existing.edit(payload); else await channel.send(payload);
  }
}
async function ensureRestartChannel(guild) {
  await guild.channels.fetch();
  let channel = channelByName(guild, 'server-restarts', ChannelType.GuildText);
  if (!channel) channel = await guild.channels.create({name:'server-restarts',type:ChannelType.GuildText,permissionOverwrites:[{id:guild.id,type:OverwriteType.Role,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory],deny:[PermissionFlagsBits.SendMessages]},{id:client.user.id,type:OverwriteType.Member,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.EmbedLinks]}]});
  return channel;
}
const restartAnnouncements = new Map();
async function announceRestart(guild) {
  if (restartAnnouncements.has(guild.id)) throw new Error('A restart announcement is already sending or was sent within the last minute.');
  restartAnnouncements.set(guild.id, true);
  try {
    await guild.roles.fetch();
    const role = roleByName(guild, VERIFIED_ROLE_NAME);
    if (!role) throw new Error('BloodLine role is missing.');
    const channel = await ensureRestartChannel(guild);
    const me = await guild.members.fetchMe();
    if (!role.mentionable && !channel.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone)) throw new Error('Bot needs Mention @everyone, @here, and All Roles in #server-restarts to notify BloodLine.');
    await channel.send({content:`<@&${role.id}> 🩸🔥 **BLOODLINE RZ IS BACK UP!**\n\nRestart complete—fly in, get active, and show us who really got motion! ✈️💥`,allowedMentions:{parse:[],roles:[role.id]}});
    setTimeout(() => restartAnnouncements.delete(guild.id), 60000);
    return channel;
  } catch (error) { restartAnnouncements.delete(guild.id); throw error; }
}

client.login(TOKEN);
