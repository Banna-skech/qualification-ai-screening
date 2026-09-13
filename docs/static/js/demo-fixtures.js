/*
 * 公开演示数据：只保留与在线演示相同的少量示例，不包含正式版全量资产。
 * 所有字段均为合成数据，供静态 GitHub Pages 回放使用。
 */
(function () {
  const standards = [
    ['GTM','S','V1.0',6,['S4-3','S3-1']], ['MKT','S','V1.0',5,['S3-1']],
    ['产品经理（硬件）','T','V1.0',8,['T4-2']], ['结构工程师','T','V2.0',7,['T3-2']],
    ['AI工程师','T','V1.0',5,['T3-2']], ['内审专员','P','V2.0',5,['P3-3']],
    ['招聘专员','P','V1.0',5,['P3-3']], ['测试工程师','T','V1.0',6,['T3-2']]
  ].map((s, i) => ({ id: i + 1, name: s[0], '岗位名称': s[0], sequence: s[1], '序列': s[1] + '序列', version: s[2], duty_count: s[3], level_coverage: s[4], department_scope: ['演示事业部'], keywords: s[0].split(/[（）]/), description: '结果导向；跨团队协作；专业能力与复盘机制', status: 'active', file_name: s[0] + '-任职资格标准（演示摘要）', full_text: '这是用于公开演示的岗位标准摘要。仅展示结构化预览，不提供源文件下载。', duties: [1,2,3].map((n) => ({ duty_number:n, duty_name:'职责 '+n, item_number:n+'.1', item_type:n===2?'key_behavior':'key_result', level:s[4][0], description:['建立目标与关键成果','协同推进并沉淀方法','复盘结果并持续改进'][n-1] })) }));

  const employees = [
    { id:1, name:'陈某某', department:'产品质量部', position:'测试工程师', education:'本科', years_experience:5, years_in_current:2.4, report_count:1, created_at:'2026-06-20' },
    { id:2, name:'赵某某', department:'研发事业部', position:'产品经理（硬件）', education:'硕士', years_experience:7, years_in_current:3.1, report_count:1, created_at:'2026-06-28' },
    { id:3, name:'李某某', department:'品牌市场部', position:'MKT', education:'本科', years_experience:4, years_in_current:1.8, report_count:1, created_at:'2026-07-08' },
    { id:4, name:'张某某', department:'研发事业部', position:'结构工程师', education:'本科', years_experience:6, years_in_current:2.9, report_count:1, created_at:'2026-07-10' },
    { id:5, name:'王某某', department:'全球营销部', position:'GTM', education:'本科', years_experience:8, years_in_current:3.6, report_count:1, created_at:'2026-07-15' }
  ];
  const reportMeta = [
    [1, '陈某某','产品质量部','测试工程师','T3-2',6.5,'conditional','2026-06-20'],
    [2, '赵某某','研发事业部','产品经理（硬件）','T4-2',9.1,'pass','2026-06-28'],
    [3, '李某某','品牌市场部','MKT','S3-1',5.8,'fail','2026-07-08'],
    [4, '张某某','研发事业部','结构工程师','T3-2',8.5,'pass','2026-07-10'],
    [5, '王某某','全球营销部','GTM','S4-3',7.2,'conditional','2026-07-15']
  ];
  const reports = reportMeta.map(([id, employee_name, employee_department, applied_position, applied_level, total_score, conclusion, created_at]) => ({
    id, employee_id:id, report_type:'assessment', status:'final', employee_name, employee_department, applied_position, applied_level, total_score, conclusion, created_at,
    standard_name: applied_position + '（演示标准）', rule_version:'demo-rules-0.2', raw_markdown:`## 认证总览\n\n**${employee_name}** 申请 **${applied_position} · ${applied_level}**。\n\n| 维度 | 结论 |\n| --- | --- |\n| 关键成果 | ${total_score >= 8 ? '完全覆盖' : '部分覆盖'} |\n| 关键行为 | ${conclusion === 'fail' ? '缺失' : '部分覆盖'} |\n| 知识技能 | ${total_score >= 7 ? '完全覆盖' : '部分覆盖'} |\n\n### 差距分析\n建议补充可量化结果、过程证据与复盘材料。`, line_items:[1,2,3].map((n)=>({duty_name:'职责 '+n,item_number:n+'.1',item_type:'key_result',score:n===1?2:(conclusion==='fail'?0:1),coverage:n===1?'完全':'部分',evidence:`演示材料第 ${n} 页`,reason:'基于预置证据回放'}))
  }));

  const dashboard = { total_reports:5, this_month:0, pass_count:2, conditional_count:2, fail_count:1, pass_rate:40, active_standards:8, employee_count:5 };
  const trend = { trend:[{month:'2026-02',pass_rate:33},{month:'2026-03',pass_rate:50},{month:'2026-04',pass_rate:40},{month:'2026-05',pass_rate:50},{month:'2026-06',pass_rate:40},{month:'2026-07',pass_rate:40}] };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const filterList = (items, params, keys) => { let out = items.slice(); const q=(params.search||'').toLowerCase(); if(q) out=out.filter(x=>keys.some(k=>String(x[k]||'').toLowerCase().includes(q))); if(params.conclusion) out=out.filter(x=>x.conclusion===params.conclusion); if(params.dept) out=out.filter(x=>String(x.employee_department||x.department||'').includes(params.dept)); return out; };
  window.DemoFixtures = {
    standards, employees, reports, dashboard, trend,
    get(url, params={}) {
      if (url.includes('/dashboard/summary')) return clone(dashboard);
      if (url.includes('/dashboard/pass-rate')) return clone(trend);
      if (url.includes('/reports/stats')) return { total:5, pass:2, conditional:2, fail:1, pass_rate:40 };
      if (url === '/api/reports' || url.startsWith('/api/reports?')) { const list=filterList(reports,params,['employee_name','applied_position','standard_name']); return {items:clone(list), total:list.length, page:1, pages:1, per_page:params.per_page||20}; }
      const rid=url.match(/\/api\/reports\/(\d+)/); if(rid){ const r=reports.find(x=>x.id===Number(rid[1])); return clone(r||reports[0]); }
      if (url.includes('/api/v2/standards/registry')) return { '岗位标准清单': standards.map(s=>({'岗位名称':s.name,'序列':s['序列'],id:String(s.id)})) };
      if (url === '/api/v2/standards' || url.startsWith('/api/v2/standards?') || url === '/api/standards' || url.startsWith('/api/standards?')) { let list=standards.slice(); if(params.sequence) list=list.filter(s=>s.sequence===params.sequence || s['序列']===params.sequence); if(params.search) list=list.filter(s=>s.name.includes(params.search)); return url.includes('/api/standards')&&!url.includes('/api/v2') ? clone(list) : {items:clone(list),total:list.length}; }
      const sid=url.match(/standards\/(\d+)/); if(sid) return clone(standards.find(s=>s.id===Number(sid[1]))||standards[0]);
      if (url === '/api/employees' || url.startsWith('/api/employees?')) { const list=filterList(employees,params,['name','position','department']); return {items:clone(list), total:list.length, page:1, pages:1}; }
      const eid=url.match(/\/api\/employees\/(\d+)/); if(eid){ const e=employees.find(x=>x.id===Number(eid[1]))||employees[0]; if(url.endsWith('/timeline')) return {employee:clone(e),timeline:reports.filter(r=>r.employee_id===e.id).map(r=>({date:r.created_at,total_score:r.total_score,conclusion:r.conclusion,applied_position:r.applied_position,applied_level:r.applied_level,report_id:r.id}))}; return Object.assign(clone(e),{reports:clone(reports.filter(r=>r.employee_id===e.id))}); }
      if(url.includes('/api/settings')) return { ai_model:'演示回放引擎', demo_mode:true };
      return {};
    },
    upload(file){ const name=file?.name||'示例认证材料.pptx'; const m=reports.find(r=>name.includes(r.employee_name))||reports[0]; const std=standards.find(s=>s.name===m.applied_position)||standards[0]; return { full_text:'演示材料文本（合成数据，仅用于本地回放）', emp_info:{'员工姓名':m.employee_name,'所在部门':m.employee_department,'申报岗位':m.applied_position,'申报级别':m.applied_level}, matched_standards:[std].map(s=>({'id':String(s.id),'岗位名称':s.name,'序列':s['序列'],'覆盖部门':s.department_scope})) }; },
    markdown(reportId=1){ const r=reports.find(x=>x.id===reportId)||reports[0]; return r.raw_markdown; }
  };
})();
