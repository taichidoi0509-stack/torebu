export function createBackend(client,userId){
 const check=(result)=>{if(result.error){const e=result.error;throw Error(e.code==='42501'?'この操作にはグループへの参加が必要です':e.code==='23514'?'重量・回数・入力内容を確認してください':e.code==='23503'?'記録が見つかりません':/[ぁ-んァ-ン一-龯]/.test(e.message||'')?e.message:'保存・読み込みに失敗しました。もう一度お試しください')}return result.data};
 return {
 async groups(body){
  if(!body){const [groups,profile]=await Promise.all([client.from('torebu_groups').select('id,name,invite_code,torebu_members(count)').order('created_at'),client.from('torebu_profiles').select('name').eq('user_id',userId()).maybeSingle()]);return {groups:check(groups).map(g=>({...g,member_count:g.torebu_members?.[0]?.count||0})),profile:check(profile)}}
  if(body.action==='profile'){check(await client.from('torebu_profiles').upsert({user_id:userId(),name:body.name}));return {ok:true}}
  if(body.action==='create'){return {id:check(await client.rpc('torebu_create_group',{group_name:body.name}))}}
  if(body.action==='join'){return {id:check(await client.rpc('torebu_join_group',{code:body.code}))}}
  throw Error('操作を確認してください');
 },
 async training(room,body){
  if(!body){
   const readPosts=async()=>{const all=[];for(let offset=0;;offset+=1000){const rows=check(await client.from('torebu_workouts').select('*').eq('group_id',room).order('created_at',{ascending:false}).order('id').range(offset,offset+999));all.push(...rows);if(rows.length<1000)break}return [...new Map(all.map(p=>[p.id,p])).values()]};
   const readMembers=async()=>{const members=check(await client.from('torebu_members').select('user_id').eq('group_id',room));if(!members.length)return [];const names=check(await client.from('torebu_profiles').select('user_id,name').in('user_id',members.map(m=>m.user_id)));return members.map(m=>({...m,name:names.find(p=>p.user_id===m.user_id)?.name||'メンバー'}))};
   const [posts,likes,comments,members]=await Promise.all([readPosts(),client.from('torebu_likes').select('workout_id,user_id,torebu_workouts!inner(group_id)').eq('torebu_workouts.group_id',room).limit(5000),client.from('torebu_comments').select('id,workout_id,user_id,name,body,created_at,torebu_workouts!inner(group_id)').eq('torebu_workouts.group_id',room).order('created_at').limit(5000),readMembers()]);return {user:{id:userId()},members,posts:posts.map(p=>({...p,room_id:p.group_id,created_at:Date.parse(p.created_at)})),likes:check(likes).map(l=>({...l,post_id:l.workout_id})),comments:check(comments).map(c=>({...c,post_id:c.workout_id,created_at:Date.parse(c.created_at)}))}}

  if(body.action==='post'){check(await client.from('torebu_workouts').upsert({id:body.id,group_id:room,user_id:userId(),name:body.name,day:body.day,note:body.note,items:body.items},{onConflict:'id',ignoreDuplicates:true}));return {ok:true}}
  if(body.action==='delete'){check(await client.from('torebu_workouts').delete().eq('id',body.postId).eq('group_id',room).eq('user_id',userId()));return {ok:true}}
  if(body.action==='like'){if(body.liked)check(await client.from('torebu_likes').upsert({workout_id:body.postId,user_id:userId()},{onConflict:'workout_id,user_id',ignoreDuplicates:true}));else check(await client.from('torebu_likes').delete().eq('workout_id',body.postId).eq('user_id',userId()));return {ok:true}}
  if(body.action==='comment'){check(await client.from('torebu_comments').insert({workout_id:body.postId,user_id:userId(),name:body.name,body:body.body}));return {ok:true}}
  throw Error('操作を確認してください');
 }
 }
}
