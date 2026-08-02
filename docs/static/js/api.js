/**
 * Mock API — GitHub Pages 演示版数据层
 * 拦截所有 API 调用，返回完整结构的演示数据
 */
(function () {

// ====================================================================
// Demo Data
// ====================================================================
const STD_REGISTRY = [
  {id:'gtm',岗位名称:'GTM',序列:'S序列',覆盖部门:['手电事业部','探索事业部'],标准文件:'1、GTM-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['GTM','产品上市','市场策略'],职责数量:6,特殊规则:null},
  {id:'mkt',岗位名称:'MKT',序列:'S序列',覆盖部门:[],标准文件:'2、MKT-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['MKT','市场营销','品牌推广'],职责数量:5,特殊规则:null},
  {id:'pm-hardware',岗位名称:'产品经理（硬件）',序列:'T序列',覆盖部门:['研发事业部'],标准文件:'1、产品经理（硬件）-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['产品经理','硬件','产品定义'],职责数量:8,特殊规则:null},
  {id:'pm-software',岗位名称:'产品经理（软件）',序列:'T序列',覆盖部门:[],标准文件:'1、产品经理（软件）-任职资格标准-V2.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['产品经理','软件'],职责数量:8,特殊规则:null},
  {id:'cmf',岗位名称:'CMF工程师',序列:'T序列',覆盖部门:[],标准文件:'3、CMF工程师-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['CMF','工艺','设计'],职责数量:5,特殊规则:null},
  {id:'ai-engineer',岗位名称:'AI工程师',序列:'T序列',覆盖部门:[],标准文件:'4、AI工程师-岗位任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['AI','机器学习','算法'],职责数量:5,特殊规则:null},
  {id:'id-engineer',岗位名称:'ID工程师',序列:'T序列',覆盖部门:[],标准文件:'5、ID工程师-任职资格标准-V2.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['ID','工业设计'],职责数量:6,特殊规则:null},
  {id:'electronic',岗位名称:'电子工程师',序列:'T序列',覆盖部门:[],标准文件:'7、电子工程师-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['电子','硬件','电路'],职责数量:7,特殊规则:null},
  {id:'software',岗位名称:'软件工程师',序列:'T序列',覆盖部门:[],标准文件:'8、软件工程师-任职资格标准-V2.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['软件','开发'],职责数量:6,特殊规则:null},
  {id:'project',岗位名称:'项目工程师',序列:'T序列',覆盖部门:[],标准文件:'9、项目工程师-任职资格标准-V2.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['项目','管理'],职责数量:6,特殊规则:null},
  {id:'structure',岗位名称:'结构工程师',序列:'T序列',覆盖部门:['研发事业部'],标准文件:'10、结构工程师-任职资格标准-V2.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['结构','设计','模具'],职责数量:7,特殊规则:null},
  {id:'optical',岗位名称:'光学工程师',序列:'T序列',覆盖部门:[],标准文件:'11、光学工程师-任职资格标准-V2.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['光学','透镜'],职责数量:6,特殊规则:null},
  {id:'backend',岗位名称:'后端工程师',序列:'T序列',覆盖部门:[],标准文件:'14、后端工程师-任职资格标准-V2.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['后端','API'],职责数量:6,特殊规则:null},
  {id:'frontend',岗位名称:'前端工程师',序列:'T序列',覆盖部门:[],标准文件:'15、前端工程师-任职资格标准-V2.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['前端','UI'],职责数量:6,特殊规则:null},
  {id:'planning',岗位名称:'产品规划工程师',序列:'T序列',覆盖部门:[],标准文件:'19、产品规划工程师-任职资格标准-V2.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['规划','产品'],职责数量:6,特殊规则:null},
  {id:'automation',岗位名称:'自动化工程师',序列:'T序列',覆盖部门:[],标准文件:'20、自动化工程师-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['自动化'],职责数量:5,特殊规则:null},
  {id:'hr',岗位名称:'人事专员',序列:'P序列',覆盖部门:[],标准文件:'23、人事专员-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['人事','招聘'],职责数量:5,特殊规则:null},
  {id:'legal',岗位名称:'法务专员',序列:'P序列',覆盖部门:[],标准文件:'27、法务专员-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['法务'],职责数量:5,特殊规则:null},
  {id:'audit',岗位名称:'内审专员',序列:'P序列',覆盖部门:[],标准文件:'29、内审专员-岗位任职资格标准V2.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['内审','审计'],职责数量:5,特殊规则:null},
  {id:'recruiter',岗位名称:'招聘专员',序列:'P序列',覆盖部门:[],标准文件:'24、招聘专员-任职资格标准-V1.0.xlsx',级别覆盖:['助理','初级','中级','高级','专家'],关键词:['招聘'],职责数量:5,特殊规则:null},
];

const V2_STANDARDS = STD_REGISTRY.map(s => ({
  id: s.id, name: s.岗位名称, sequence: s.序列.replace('序列',''),
  version: (s.标准文件.match(/V\d+\.?\d*/) || ['V1.0'])[0],
  duty_count: s.职责数量,
  level_coverage: [s.序列.replace('序列','')+'1',s.序列.replace('序列','')+'2-1',s.序列.replace('序列','')+'2-2',s.序列.replace('序列','')+'2-3',s.序列.replace('序列','')+'3-1',s.序列.replace('序列','')+'3-2',s.序列.replace('序列','')+'3-3',s.序列.replace('序列','')+'4-1',s.序列.replace('序列','')+'4-2',s.序列.replace('序列','')+'4-3',s.序列.replace('序列','')+'5-1',s.序列.replace('序列','')+'5-2',s.序列.replace('序列','')+'5-3'],
  department_scope: s.覆盖部门, keywords: s.关键词,
  file_name: s.标准文件, file_path: s.序列+'/'+s.标准文件,
  registry_id: s.id, status: 'active',
  description: s.关键词.length ? s.关键词.join('；') : ''
}));

const REPORTS = [
  {id:1,report_type:'assessment',employee_name:'王某某',employee_department:'手电事业部-产品部',applied_position:'GTM',applied_level:'S4-3',total_score:7.2,conclusion:'conditional',status:'final',created_at:'2026-07-15',raw_markdown:'',standard_name:null},
  {id:2,report_type:'assessment',employee_name:'张某某',employee_department:'研发事业部-结构部',applied_position:'结构工程师',applied_level:'T3-2',total_score:8.5,conclusion:'pass',status:'final',created_at:'2026-07-10',raw_markdown:'',standard_name:null},
  {id:3,report_type:'assessment',employee_name:'李某某',employee_department:'电商事业部',applied_position:'MKT',applied_level:'S3-1',total_score:5.8,conclusion:'fail',status:'final',created_at:'2026-07-08',raw_markdown:'',standard_name:null},
  {id:4,report_type:'assessment',employee_name:'赵某某',employee_department:'研发事业部-产品部',applied_position:'产品经理（硬件）',applied_level:'T4-2',total_score:9.1,conclusion:'pass',status:'final',created_at:'2026-06-28',raw_markdown:'',standard_name:null},
  {id:5,report_type:'assessment',employee_name:'陈某某',employee_department:'品质中心',applied_position:'测试工程师',applied_level:'T3-2',total_score:6.5,conclusion:'conditional',status:'final',created_at:'2026-06-20',raw_markdown:'',standard_name:null},
];

const EMPLOYEES = [
  {id:1,name:'王某某',department:'手电事业部-产品部',position:'高级GTM',education:'本科',years_experience:8,years_in_current:4,email:'wanghb@example.com',is_active:true,created_at:'2025-03-01',report_count:2},
  {id:2,name:'张某某',department:'研发事业部-结构部',position:'结构工程师',education:'硕士',years_experience:5,years_in_current:3,email:'zhangming@example.com',is_active:true,created_at:'2025-06-15',report_count:1},
  {id:3,name:'李某某',department:'电商事业部',position:'MKT专员',education:'本科',years_experience:3,years_in_current:1.5,email:'liting@example.com',is_active:true,created_at:'2026-01-10',report_count:1},
  {id:4,name:'赵某某',department:'研发事业部-产品部',position:'高级产品经理',education:'硕士',years_experience:10,years_in_current:6,email:'zhaolei@example.com',is_active:true,created_at:'2024-08-20',report_count:3},
  {id:5,name:'陈某某',department:'品质中心',position:'测试工程师',education:'本科',years_experience:6,years_in_current:2,email:'chenfang@example.com',is_active:true,created_at:'2025-09-01',report_count:2},
];

const PASS_RATE_TREND = [{month:'2026-01',pass_rate:62},{month:'2026-02',pass_rate:58},{month:'2026-03',pass_rate:71},{month:'2026-04',pass_rate:65},{month:'2026-05',pass_rate:74},{month:'2026-06',pass_rate:68},{month:'2026-07',pass_rate:60}];

const TIMELINE_DEMO = {timeline:[{date:'2025-07-15',total_score:5.2},{date:'2026-01-10',total_score:6.8},{date:'2026-07-15',total_score:7.2}]};

const DEMO_REPORT_MD = `# 🏆 任职资格认证初审报告

## 📌 基本信息

| 项目 | 内容 |
|------|------|
| 员工姓名 | 王某某 |
| 所在部门 | 手电事业部-产品部 |
| 当前岗位 | 高级GTM |
| 申报岗位 | GTM |
| 申报级别 | S4-3（高级·第3档） |
| 认证日期 | 2026年7月15日 |
| 使用标准 | 《GTM-任职资格标准-V1.0》 |

## 📊 认证总览

| 职责 | 得分 | 评级 |
|------|------|------|
| 职责一：市场战略规划 | 2/2 | ✅ 完全达成 |
| 职责二：产品上市管理 | 2/2 | ✅ 完全达成 |
| 职责三：渠道策略制定 | 1/2 | ⚠️ 基本达成 |
| 职责四：竞品与市场分析 | 2/2 | ✅ 完全达成 |
| 职责五：销售赋能 | 1/2 | ⚠️ 基本达成 |
| 职责六：跨部门协作 | 2/2 | ✅ 完全达成 |
| **综合总分** | **10 / 12** | — |

### 🎯 认证结论

> **[⚠️ 有条件通过（10-13分）]**

**结论说明**：员工在市场战略规划与产品上市管理方面表现突出，举证材料充分且有具体数据支撑。渠道策略和销售赋能方面证据偏弱，需补充量化成果后重新提交。

## 📋 逐条检查详情

### 职责一：市场战略规划

| # | 类型 | 标准要求摘要 | 举证内容摘要 | 覆盖 | 问题说明 |
|----|------|-------------|-------------|------|----------|
| 1.1 | 关键成果 | 参与公司级SP/BP制定，指导产品路线图 | 手电系列用户分群；Pro系列定位与组合策略 | ✅ | 路线图完整，覆盖6款新品，时间节点明确 |
| 1.2 | 关键行为 | 输出年度市场战略规划文档 | PPT第5页：2025-2026市场战略规划 v2.0 | ✅ | 文档结构规范清晰，评审记录完整 |

**本职责得分：2/2** — 市场战略规划方面举证完整，有数据支撑且文档规范。

### 职责三：渠道策略制定

| # | 类型 | 标准要求摘要 | 举证内容摘要 | 覆盖 | 问题说明 |
|----|------|-------------|-------------|------|----------|
| 3.1 | 关键成果 | 独立制定2+渠道策略方案 | PPT第18页：提及渠道优化内容 | ⚠️ | 缺少独立渠道策略文档作为佐证材料 |
| 3.2 | 关键行为 | 输出渠道数据分析报告 | 无对应举证 | ❌ | 建议补充渠道ROI对比数据和分析报告 |

**本职责得分：1/2** — 有渠道相关工作内容但缺乏系统性方案文档和数据支撑。

## 🎯 差距分析

### 🔴 关键差距（得分<5分的条目）

暂无严重差距项。

### 🟡 提升空间（得分5-7分的条目）

| 序号 | 职责 | 得分 | 问题 | 提升建议 |
|------|------|------|------|----------|
| 1 | 职责三 | 1/2 | 渠道策略缺乏量化数据和方案文件 | 补充渠道ROI分析报告 |
| 2 | 职责五 | 1/2 | 销售赋能案例缺少培训记录 | 提供培训签到表、效果评估 |

## 💡 改进建议

### 🚨 紧急（必须补充，否则影响认证结果）
1. **【职责三】** 补充渠道策略方案文档（至少2份），附带渠道ROI对比数据

### 📌 重要（建议补充，可显著提升分数）
1. **【职责五】** 提供销售培训记录、培训材料和参训人员反馈

> 🤖 本报告由任职资格认证AI初筛系统自动生成 | 演示版 | 2026-07-15`;

// ====================================================================
// Mock Implementation
// ====================================================================
function delay() { return new Promise(r => setTimeout(r, 80 + Math.random()*180)); }

function paginate(items, page, per_page) {
  page = page || 1; per_page = per_page || 20;
  const total = items.length, pages = Math.max(1, Math.ceil(total/per_page));
  return { items: items.slice((page-1)*per_page, page*per_page), page, pages, total };
}

window.API = {
  async get(url, params = {}) {
    await delay();
    // Dashboard
    if (url === '/api/dashboard/summary') {
      var p = REPORTS.filter(r=>r.conclusion==='pass'), c = REPORTS.filter(r=>r.conclusion==='conditional');
      return {total_reports:REPORTS.length, pass_rate:Math.round(p.length/REPORTS.length*100), pass_count:p.length, conditional_count:c.length, fail_count:REPORTS.length-p.length-c.length, active_standards:V2_STANDARDS.length, employee_count:EMPLOYEES.length, this_month:0};
    }
    if (url === '/api/dashboard/pass-rate') return {trend:PASS_RATE_TREND};
    // Reports
    if (url === '/api/reports/stats') return {total:REPORTS.length};
    if (url === '/api/reports') {
      var items = [...REPORTS];
      if (params.search) { var s = params.search.toLowerCase(); items = items.filter(r=>r.employee_name.toLowerCase().includes(s)||r.applied_position.toLowerCase().includes(s)); }
      if (params.conclusion) items = items.filter(r=>r.conclusion===params.conclusion);
      if (params.type && params.type!=='assessment') items = [];
      items.sort((a,b)=>b.id-a.id);
      return paginate(items, parseInt(params.page)||1, params.per_page);
    }
    var rm = url.match(/^\/api\/reports\/(\d+)$/);
    if (rm) { var r = REPORTS.find(x=>x.id===parseInt(rm[1])); if(!r) throw{error:'报告不存在'}; return Object.assign({},r,{raw_markdown:DEMO_REPORT_MD}); }
    // Old Standards API
    if (url === '/api/standards') return STD_REGISTRY;
    var sm = url.match(/^\/api\/standards\/(.+)$/);
    if (sm) { var s = STD_REGISTRY.find(x=>x.id===sm[1]); if(!s) throw{error:'标准不存在'}; return {id:s.id,岗位名称:s.岗位名称,序列:s.序列,full_text:JSON.stringify(s),序列_letter:s.序列.replace('序列',''),覆盖部门:s.覆盖部门}; }
    // V2 Standards
    if (url === '/api/v2/standards') {
      var items = [...V2_STANDARDS];
      if (params.sequence) items = items.filter(s=>s.sequence===params.sequence);
      if (params.search) items = items.filter(s=>s.name.includes(params.search));
      return {items:items, total:items.length};
    }
    var svm = url.match(/^\/api\/v2\/standards\/(.+)$/);
    if (svm) {
      var vs = V2_STANDARDS.find(x=>x.id===svm[1]||x.registry_id===svm[1]);
      if(!vs) throw{error:'标准不存在'};
      var duties = [], dnames=['市场战略规划','产品上市管理','渠道策略制定','竞品与市场分析','销售赋能','跨部门协作','产品规划与定义','质量管理'];
      for(var i=1; i<=vs.duty_count; i++) {
        var dn = dnames[(i-1)%dnames.length], cn = ['一','二','三','四','五','六','七','八'][i-1];
        duties.push({id:1000+i,standard_id:vs.id,duty_number:i,duty_name:'职责'+cn+'：'+dn,item_number:i+'.1',item_type:'key_result',level:'ALL',description:dn+'相关的关键成果要求',sort_order:i-1});
        duties.push({id:2000+i,standard_id:vs.id,duty_number:i,duty_name:'职责'+cn+'：'+dn,item_number:i+'.2',item_type:'key_behavior',level:'ALL',description:'支撑'+dn+'的关键行为要求',sort_order:i-1});
      }
      return Object.assign({},vs,{duties:duties,full_text:'岗位名称：'+vs.name+'\n序列：'+vs.sequence+'序列\n关键职责数量：'+vs.duty_count,岗位名称:vs.name,序列:vs.sequence+'序列'});
    }
    if (url === '/api/v2/standards/registry') return {岗位标准清单:STD_REGISTRY};
    if (url === '/api/v2/standards/sync/preview') return {new_count:0,existing_count:V2_STANDARDS.length,new_standards:[]};
    // Employees
    if (url === '/api/employees') {
      var items = [...EMPLOYEES];
      if (params.search) items = items.filter(e=>e.name.includes(params.search)||e.position.includes(params.search));
      if (params.dept) items = items.filter(e=>e.department.includes(params.dept));
      return paginate(items, parseInt(params.page)||1, params.per_page);
    }
    var em = url.match(/^\/api\/employees\/(\d+)$/);
    if (em) { var e = EMPLOYEES.find(x=>x.id===parseInt(em[1])); if(!e) throw{error:'员工不存在'}; return Object.assign({},e,{reports:REPORTS.filter(r=>r.employee_name===e.name)}); }
    var etm = url.match(/^\/api\/employees\/(\d+)\/timeline$/);
    if (etm) return TIMELINE_DEMO;
    // Settings
    if (url === '/api/settings') return {deepseek_api_key:'••••演示模式',ai_model:'deepseek-V4-pro',ai_base_url:'https://api.deepseek.com/anthropic',app_version:'2.0-demo'};
    throw {error:'演示版不支持 GET '+url};
  },

  async post(url, data) {
    await delay();
    if (url === '/api/analyze') return {success:true};
    if (url === '/api/upload-ppt' || url.indexOf('/api/upload')===0) {
      return {full_text:'员工姓名：王某某\n所在部门：产品事业部\n申报岗位：GTM\n申报级别：S4-3\n\n举证材料摘要',emp_info:{'员工姓名':'王某某','所在部门':'产品事业部','申报岗位':'GTM','申报级别':'S4-3'},matched_standards:[{id:'gtm',岗位名称:'GTM',序列:'S序列',覆盖部门:['手电事业部']},{id:'mkt',岗位名称:'MKT',序列:'S序列',覆盖部门:[]}]};
    }
    if (url.indexOf('/api/v2/standards/sync')>=0 || url.indexOf('/api/v2/standards/refresh')>=0) return {success:true,message:'同步完成（演示模式）',synced:0,updated:0};
    if (url === '/api/v2/standards/extract-summaries') return {success:true,message:'已提取摘要（演示版）',updated:V2_STANDARDS.length};
    if (url === '/api/v2/standards/audit/save') return {success:true,message:'报告已保存（演示版）'};
    if (url === '/api/employees') return {success:true,message:'员工已添加（演示版）',id:99};
    if (url === '/api/employees/sync') return {success:true,message:'同步完成（演示版）'};
    throw {error:'演示版不支持 POST '+url};
  },

  async put(url, data) {
    await delay();
    return {success:true,message:'设置已保存（演示版）'};
  },

  async del(url, data) {
    await delay();
    if (url.match(/^\/api\/reports\/\d+$/)) return {success:true};
    if (url === '/api/reports/batch') return {success:true,message:'已批量删除（演示版）'};
    if (url.match(/^\/api\/employees\/\d+$/)) return {success:true};
    throw {error:'演示版不支持此操作'};
  },

  async uploadFile(url, file, fieldName) {
    await delay();
    return this.post(url);
  },

  streamSSE(url, body, callbacks) {
    var lines = DEMO_REPORT_MD.split('\n'), i = 0;
    var id = setInterval(function() {
      if (i >= lines.length) { clearInterval(id); if(callbacks.onDone) callbacks.onDone({}); return; }
      var cnt = Math.min(1+Math.floor(Math.random()*3), lines.length-i);
      if(callbacks.onChunk) callbacks.onChunk(lines.slice(i,i+cnt).join('\n')+'\n');
      i += cnt;
    }, 40);
    return {abort:function(){clearInterval(id);}};
  },
};

})();

// ====================================================================
// Global fetch interceptor — handle cases where page modules use
// raw fetch() instead of API.get/post (batch.js registry, exports, etc.)
// ====================================================================
(function() {
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    var urlStr = typeof url === 'string' ? url : url.url;
    // Intercept known API patterns
    if (urlStr === '/api/v2/standards/registry') {
      return Promise.resolve(new Response(JSON.stringify({岗位标准清单: window._REGISTRY || []}), {status:200, headers:{'Content-Type':'application/json'}}));
    }
    // Export/download endpoints — show toast instead
    if (urlStr.indexOf('/api/export/') >= 0 || urlStr.indexOf('/api/v2/standards/audit') >= 0 || urlStr.indexOf('/standards-file/') >= 0) {
      setTimeout(function() { if(window.showToast) showToast('演示版不支持文件下载\n完整系统请部署至本地运行','warning'); }, 100);
      return Promise.reject(new Error('演示版不支持'));
    }
    // Pass through to original
    return origFetch.apply(this, arguments);
  };
  // Also pipe registry data for the fetch interceptor
  setTimeout(function() {
    try { API.get('/api/v2/standards/registry').then(function(r) { window._REGISTRY = r['岗位标准清单']; }).catch(function(){}); } catch(e) {}
  }, 50);
})();
