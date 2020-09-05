const name = '东东萌宠';
const $ = new Env(name);
let cookiesArr = [], cookie = '', jdPetShareArr = [], isBox = false, notify, newShareCodes;
//助力好友分享码(最多5个,否则后面的助力失败),原因:京东农场每人每天只有四次助力机会
//此此内容是IOS用户下载脚本到本地使用，填写互助码的地方，同一京东账号的好友互助码请使用@符号隔开。
//下面给出两个账号的填写示例（iOS只支持2个京东账号）
let shareCodes = [ // 这个列表填入你要助力的好友的shareCode
  //账号一的好友shareCode,不同好友的shareCode中间用@符号隔开
  'MTAxODc2NTEzNTAwMDAwMDAwMjg3MDg2MA==@MTAxODc2NTEzMzAwMDAwMDAyNzUwMDA4MQ==@MTAxODc2NTEzMjAwMDAwMDAzMDI3MTMyOQ==@MTAxODc2NTEzNDAwMDAwMDAzMDI2MDI4MQ==@MTAxODcxOTI2NTAwMDAwMDAxOTQ3MjkzMw==',
  //账号二的好友shareCode,不同好友的shareCode中间用@符号隔开
  'MTAxODc2NTEzMjAwMDAwMDAzMDI3MTMyOQ==@MTAxODcxOTI2NTAwMDAwMDAyNjA4ODQyMQ==',
]
let message = '', subTitle = '', option = {}, UserName = '';
let jdNotify = $.getdata('jdPetNotify');//是否关闭通知，false打开，true通知
let jdServerNotify = true;//是否每次运行脚本后，都发送server酱微信通知提醒,默认是true【true:发送，false:不发送】
const JD_API_HOST = 'https://api.m.jd.com/client.action';
let goodsUrl = '', taskInfoKey = [];
//按顺序执行, 尽量先执行不消耗狗粮的任务, 避免中途狗粮不够, 而任务还没做完
let function_map = {
  signInit: signInit, //每日签到
  threeMealInit: threeMealInit, //三餐
  browseSingleShopInit: browseSingleShopInit, //浏览店铺1
  browseSingleShopInit2: browseSingleShopInit2, //浏览店铺2
  browseSingleShopInit3: browseSingleShopInit3, //浏览店铺3
  browseShopsInit: browseShopsInit, //浏览店铺s, 目前只有一个店铺
  firstFeedInit: firstFeedInit, //首次喂食
  inviteFriendsInit: inviteFriendsInit, //邀请好友, 暂未处理
  feedReachInit: feedReachInit, //喂食10次任务  最后执行投食10次任务, 提示剩余狗粮是否够投食10次完成任务, 并询问要不要继续执行
}
!(async () => {
  await requireConfig();
  if (!cookiesArr[0]) {
    $.msg($.name, '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/', {"open-url": "https://bean.m.jd.com/"});
    return;
  }
  for (let i = 0; i < cookiesArr.length; i++) {
    if (cookiesArr[i]) {
      cookie = cookiesArr[i];
      UserName = decodeURIComponent(cookie.match(/pt_pin=(.+?);/) && cookie.match(/pt_pin=(.+?);/)[1])
      $.index = i + 1;
      console.log(`\n开始【京东账号${$.index}】${UserName}\n`);
      message = '';
      subTitle = '';
      goodsUrl = '';
      taskInfoKey = [];
      option = {};
      await shareCodesFormat();
      await jdPet();
    }
  }
})()
    .catch((e) => {
      $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
    })
    .finally(() => {
      $.done();
    })
async function jdPet() {
  //查询jd宠物信息
  const initPetTownRes = await request('initPetTown');
  message = `【京东账号${$.index}】${UserName}\n`;
  if (initPetTownRes.code === '0' && initPetTownRes.resultCode === '0' && initPetTownRes.message === 'success') {
    $.petInfo = initPetTownRes.result;
    if ($.petInfo.userStatus === 0) {
      $.msg(name, '【提示】此账号萌宠活动未开始，请手动去京东APP开启活动\n入口：我的->游戏与互动->查看更多', '', { "open-url": "openapp.jdmoble://" });
      return
    }
    goodsUrl = $.petInfo.goodsInfo && $.petInfo.goodsInfo.goodsUrl;
    option['media-url'] = goodsUrl;
    // console.log(`初始化萌宠信息完成: ${JSON.stringify(petInfo)}`);
    if ($.petInfo.petStatus === 5 && $.petInfo.showHongBaoExchangePop) {
      option['open-url'] = "openApp.jdMobile://";
      $.msg($.name, `【提醒⏰】${$.petInfo.goodsInfo.goodsName}已可领取`, '请去京东APP或微信小程序查看', option);
      if ($.isNode()) {
        await notify.sendNotify(`${$.name}奖品已可领取`, `京东账号${$.index} ${UserName}\n\n${$.petInfo.goodsInfo.goodsName}已可领取`);
      }
      if ($.isNode()) {
        await notify.BarkNotify(`【提醒⏰】${$.petInfo.goodsInfo.goodsName}已可领取`, `请去京东APP或微信小程序查看`);
      }
      return
    }
    console.log(`\n【您的互助码shareCode】 ${$.petInfo.shareCode}\n`);
    await taskInit();
    if ($.taskInit.resultCode === '9999' || !$.taskInit.result) {
      console.log('初始化任务异常, 请稍后再试');
      return
    }
    $.taskInfo = $.taskInit.result;

    await petSport();//遛弯
    await slaveHelp();//助力好友
    await masterHelpInit();//获取助力的信息
    await doTask();//做日常任务
    await feedPetsAgain();//再次投食
    await energyCollect();//收集好感度
    await showMsg();
    console.log('全部任务完成, 如果帮助到您可以点下🌟STAR鼓励我一下, 明天见~');
  } else if (initPetTownRes.code === '0'){
    if (initPetTownRes.resultCode === '2001') {
      $.msg($.name, '【提示】京东cookie已失效,请重新登录获取', 'https://bean.m.jd.com/', {"open-url": "https://bean.m.jd.com/"});
      if ($.index === 1) {
        $.setdata('', 'CookieJD');//cookie失效，故清空cookie。
      } else if ($.index === 2){
        $.setdata('', 'CookieJD2');//cookie失效，故清空cookie。
      }
      if ($.isNode()) {
        await notify.sendNotify(`${$.name}cookie已失效`, `京东账号${$.index} ${UserName}\n\n请重新登录获取cookie`);
      }
      if ($.isNode()) {
        await notify.BarkNotify(`${$.name}cookie已失效`, `京东账号${$.index} ${UserName}\n请重新登录获取cookie`);
      }
    } else {
      console.log(`初始化萌宠失败:  ${initPetTownRes.message}`);
    }
  }
}
// 收取所有好感度
async function energyCollect() {
  console.log('开始收取任务奖励好感度');
  let function_id = arguments.callee.name.toString();
  const response = await request(function_id);
  // console.log(`收取任务奖励好感度完成:${JSON.stringify(response)}`);
  if (response.code === '0') {
    message += `【第${response.result.medalNum + 1}块勋章完成进度】${response.result.medalPercent}%，还需收集${response.result.needCollectEnergy}好感\n`;
    message += `【已获得勋章】${response.result.medalNum}块，还需收集${response.result.needCollectMedalNum}块即可兑换奖品“${$.petInfo.goodsInfo.goodsName}”\n`;
  }
}
//再次投食
async function feedPetsAgain() {
  const response = await request('initPetTown');//再次初始化萌宠
  if (response.code === '0' && response.resultCode === '0' && response.message === 'success') {
    $.petInfo = response.result;
    let foodAmount = $.petInfo.foodAmount; //剩余狗粮
    if (foodAmount - 100 >= 10) {
      for (let i = 0; i < parseInt((foodAmount - 100) / 10); i++) {
        const feedPetRes = await request('feedPets');
        console.log(`投食feedPetRes`);
        if (feedPetRes.resultCode == 0 && feedPetRes.code == 0) {
          console.log('投食成功')
        }
      }
      const response2 = await request('initPetTown');
      $.petInfo = response2.result;
      subTitle = $.petInfo.goodsInfo.goodsName;
      message += `【与爱宠相识】${$.petInfo.meetDays}天\n`;
      message += `【剩余狗粮】${$.petInfo.foodAmount}g\n`;
    } else {
      console.log("目前剩余狗粮：【" + foodAmount + "】g,不再继续投食,保留100g用于完成第二天任务");
      subTitle = $.petInfo.goodsInfo.goodsName;
      message += `【与爱宠相识】${$.petInfo.meetDays}天\n`;
      message += `【剩余狗粮】${$.petInfo.foodAmount}g\n`;
    }
  } else {
    console.log(`初始化萌宠失败:  ${JSON.stringify($.petInfo)}`);
  }
}


async function doTask() {
  $.taskInfo['taskList'].forEach((val) => {
    taskInfoKey.push(val);
  })
  // 任务开始
  for (let task_name in function_map) {
    if (taskInfoKey.indexOf(task_name) !== -1) {
      taskInfoKey.splice(taskInfoKey.indexOf(task_name), 1);
    }
    if ($.taskInfo[task_name] && !$.taskInfo[task_name].finished) {
      console.log('任务' + task_name + '开始');
      // yield eval(task_name + '()');
      await function_map[task_name]();
    } else {
      console.log('任务' + task_name + '已完成');
    }
  }
  for (let item of taskInfoKey) {
    console.log(`新任务 【${$.taskInfo[item].title}】 功能未开发，请反馈给脚本维护者@lxk0301\n`);
    $.msg($.name, subTitle, `新的任务 【${$.taskInfo[item].title}】 功能未开发，请反馈给脚本维护者@lxk0301\n`, {"open-url": "https://t.me/JD_fruit_pet"})
  }
}
// 好友助力信息
async function masterHelpInit() {
  let res = await request(arguments.callee.name.toString());
  // console.log(`助力信息: ${JSON.stringify(res)}`);
  if (res.code === '0' && res.resultCode === '0') {
    if (res.result.masterHelpPeoples && res.result.masterHelpPeoples.length >= 5) {
      if(!res.result.addedBonusFlag) {
        console.log("开始领取额外奖励");
        let getHelpAddedBonusResult = await request('getHelpAddedBonus');
        console.log(`领取30g额外奖励结果：【${getHelpAddedBonusResult.message}】`);
        message += `【额外奖励${getHelpAddedBonusResult.result.reward}领取】${getHelpAddedBonusResult.message}\n`;
      } else {
        console.log("已经领取过5好友助力额外奖励");
        message += `【额外奖励】已领取\n`;
      }
    } else {
      console.log("助力好友未达到5个")
      message += `【额外奖励】领取失败，原因：助力好友未达5个\n`;
    }
    if (res.result.masterHelpPeoples && res.result.masterHelpPeoples.length > 0) {
      console.log('帮您助力的好友的名单开始')
      let str = '';
      res.result.masterHelpPeoples.map((item, index) => {
        if (index === (res.result.masterHelpPeoples.length - 1)) {
          str += item.nickName || "匿名用户";
        } else {
          str += (item.nickName || "匿名用户") + '，';
        }
      })
      message += `【助力您的好友】${str}\n`;
    }
  }
}
/**
 * 助力好友, 暂时支持一个好友, 需要拿到shareCode
 * shareCode为你要助力的好友的
 * 运行脚本时你自己的shareCode会在控制台输出, 可以将其分享给他人
 */
async function slaveHelp() {
  let helpPeoples = '';
  for (let code of newShareCodes) {
    console.log(`开始助力好友: ${code}`);
    let response = await request(arguments.callee.name.toString(), {'shareCode': code});
    if (response.code === '0' && response.resultCode === '0') {
      if (response.result.helpStatus === 0) {
        console.log('已给好友: 【' + response.result.masterNickName + '】助力');
        helpPeoples += response.result.masterNickName + '，';
      } else if (response.result.helpStatus === 1) {
        // 您今日已无助力机会
        console.log(`助力好友${response.result.masterNickName}失败，您今日已无助力机会`);
        break;
      } else if (response.result.helpStatus === 2) {
        //该好友已满5人助力，无需您再次助力
        console.log(`该好友${response.result.masterNickName}已满5人助力，无需您再次助力`);
      }
    } else {
      console.log(`助理好友结果: ${response.message}`);
    }
  }
  if (helpPeoples && helpPeoples.length > 0) {
    message += `【您助力的好友】${helpPeoples.substr(0, helpPeoples.length - 1)}\n`;
  }
}
// 遛狗, 每天次数上限10次, 随机给狗粮, 每次遛狗结束需调用getSportReward领取奖励, 才能进行下一次遛狗
async function petSport() {
  console.log('开始遛弯');
  let times = 1
  const code = 0
  let resultCode = 0
  do {
    let response = await request(arguments.callee.name.toString())
    console.log(`第${times}次遛狗完成: ${JSON.stringify(response)}`);
    resultCode = response.resultCode;
    if (resultCode == 0) {
      let sportRevardResult = await request('getSportReward');
      console.log(`领取遛狗奖励完成: ${JSON.stringify(sportRevardResult)}`);
    }
    times++;
  } while (resultCode == 0 && code == 0)
  if (times > 1) {
    message += '【十次遛狗】已完成\n';
  }
}
// 初始化任务, 可查询任务完成情况
async function taskInit() {
  console.log('开始任务初始化');
  $.taskInit = await request(arguments.callee.name.toString(), {"version":1});
}
// 每日签到, 每天一次
async function signInit() {
  console.log('准备每日签到');
  const response = await request("getSignReward");
  console.log(`每日签到结果: ${JSON.stringify(response)}`);
  message += `【每日签到成功】奖励${response.result.signReward}g狗粮\n`;
}

// 三餐签到, 每天三段签到时间
async function threeMealInit() {
  console.log('准备三餐签到');
  const response = await request("getThreeMealReward");
  console.log(`三餐签到结果: ${JSON.stringify(response)}`);
  if (response.code === '0' && response.resultCode === '0') {
    message += `【定时领狗粮】获得${response.result.threeMealReward}g\n`;
  } else {
    message += `【定时领狗粮】${response.message}\n`;
  }
}

// 浏览指定店铺 任务
async function browseSingleShopInit() {
  console.log('准备浏览指定店铺');
  const body = {"index":0,"version":1,"type":1};
  const response = await request("getSingleShopReward", body);
  console.log(`点击进去response::${JSON.stringify(response)}`);
  if (response.code === '0' && response.resultCode === '0') {
    const body2 = {"index":0,"version":1,"type":2};
    const response2 = await request("getSingleShopReward", body2);
    console.log(`浏览完毕领取奖励:response2::${JSON.stringify(response2)}`);
    if (response2.code === '0' && response2.resultCode === '0') {
      message += `【浏览指定店铺】获取${response2.result.reward}g\n`;
    }
  }
}
// 临时新增任务--冰淇淋会场
async function browseSingleShopInit2() {
  console.log('准备浏览指定店铺--冰淇淋会场');
  const body = {"index":1,"version":1,"type":1};
  const body2 = {"index":1,"version":1,"type":2}
  const response = await request("getSingleShopReward", body);
  if (response.code === '0' && response.resultCode === '0') {
    const response2 = await request("getSingleShopReward", body2);
    console.log(`②浏览指定店铺结果: ${JSON.stringify(response2)}`);
    if (response2.code === '0' && response2.resultCode === '0') {
      message += `【冰淇淋会场】获取狗粮${response2.result.reward}g\n`;
    }
  }
}
async function browseSingleShopInit3() {
  console.log('准备完成 去参与星品解锁计划');
  const body = {"index":2,"version":1,"type":1};
  const body2 = {"index":2,"version":1,"type":2};
  const response = await request("getSingleShopReward", body);
  if (response.code === '0' && response.resultCode === '0') {
    const response2 = await request("getSingleShopReward", body2);
    console.log(`②浏览指定店铺结果: ${JSON.stringify(response2)}`);
    if (response2.code === '0' && response2.resultCode === '0') {
      message += `【去参与星品解锁计划】获取狗粮${response2.result.reward}g\n`;
    }
  }
}

// 浏览店铺任务, 任务可能为多个? 目前只有一个
async function browseShopsInit() {
  console.log('开始浏览店铺任务');
  let times = 0;
  let resultCode = 0;
  let code = 0;
  do {
    let response = await request("getBrowseShopsReward");
    console.log(`第${times}次浏览店铺结果: ${JSON.stringify(response)}`);
    code = response.code;
    resultCode = response.resultCode;
    times++;
  } while (resultCode == 0 && code == 0 && times < 5)
  console.log('浏览店铺任务结束');
}
// 首次投食 任务
function firstFeedInit() {
  console.log('首次投食任务合并到10次喂食任务中\n');
}

// 邀请新用户
async function inviteFriendsInit() {
  console.log('邀请新用户功能未实现');
  if ($.taskInfo.inviteFriendsInit.status == 1 && $.taskInfo.inviteFriendsInit.inviteFriendsNum > 0) {
    // 如果有邀请过新用户,自动领取60gg奖励
    const res = await request('getInviteFriendsReward');
    if (res.code == 0 && res.resultCode == 0) {
      console.log(`领取邀请新用户奖励成功,获得狗粮现有狗粮${$.taskInfo.inviteFriendsInit.reward}g，${res.result.foodAmount}g`);
      message += `【邀请新用户】获取狗粮${$.taskInfo.inviteFriendsInit.reward}g\n`;
    }
  }
}

/**
 * 投食10次 任务
 */
async function feedReachInit() {
  console.log('投食任务开始...');
  let finishedTimes = $.taskInfo.feedReachInit.hadFeedAmount / 10; //已经喂养了几次
  let needFeedTimes = 10 - finishedTimes; //还需要几次
  let tryTimes = 20; //尝试次数
  do {
    console.log(`还需要投食${needFeedTimes}次`);
    const response = await request('feedPets');
    console.log(`本次投食结果: ${JSON.stringify(response)}`);
    if (response.resultCode == 0 && response.code == 0) {
      needFeedTimes--;
    }
    if (response.resultCode == 3003 && response.code == 0) {
      console.log('剩余狗粮不足, 投食结束');
      needFeedTimes = 0;
    }
    tryTimes--;
  } while (needFeedTimes > 0 && tryTimes > 0)
  console.log('投食任务结束...\n');
}
async function showMsg() {
  if (!jdNotify || jdNotify === 'false') {
    $.msg($.name, subTitle, message, option);
    const notifyMessage = message.replace(/[\n\r]/g, '\n\n');
    if (jdServerNotify) {
      if ($.isNode()) {
        await notify.sendNotify(`${$.name} - 账号${$.index} - ${UserName}`, `${subTitle}\n\n${notifyMessage}`);
      }
      if ($.isNode()) {
        await notify.BarkNotify(`${$.name}`, `${subTitle}\n${message}`);
      }
    }
  }
}
function shareCodesFormat() {
  return new Promise(resolve => {
    console.log(`第${$.index}个京东账号的助力码:::${jdPetShareArr[$.index - 1]}`)
    if (jdPetShareArr[$.index - 1]) {
      newShareCodes = jdPetShareArr[$.index - 1].split('@');
    } else {
      console.log(`由于您未提供shareCode,将采纳本脚本自带的助力码\n`)
      const tempIndex = $.index > shareCodes.length ? (shareCodes.length - 1) : ($.index - 1);
      newShareCodes = shareCodes[tempIndex].split('@');
    }
    console.log(`格式化后第${$.index}个京东账号的助力码${JSON.stringify(newShareCodes)}`)
    resolve();
  })
}
function requireConfig() {
  return new Promise(resolve => {
    console.log('开始获取东东萌宠配置文件\n')
    notify = $.isNode() ? require('./sendNotify') : '';
    //Node.js用户请在jdCookie.js处填写京东ck;
    const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
    const jdPetShareCodes = $.isNode() ? require('./jdPetShareCodes.js') : '';
    //IOS等用户直接用NobyDa的jd cookie
    if ($.isNode()) {
      Object.keys(jdCookieNode).forEach((item) => {
        if (jdCookieNode[item]) {
          cookiesArr.push(jdCookieNode[item])
        }
      })
    } else {
      cookiesArr.push($.getdata('CookieJD'));
      cookiesArr.push($.getdata('CookieJD2'));
    }
    console.log(`共${cookiesArr.length}个京东账号\n`)
    if ($.isNode()) {
      Object.keys(jdPetShareCodes).forEach((item) => {
        if (jdPetShareCodes[item]) {
          jdPetShareArr.push(jdPetShareCodes[item])
        }
      })
    } else {
      const boxShareCodeArr = ['jd_pet1', 'jd_pet2', 'jd_pet3', 'jd_pet4', 'jd_pet5'];
      const boxShareCodeArr2 = ['jd2_pet1', 'jd2_pet2', 'jd2_pet3', 'jd2_pet4', 'jd2_pet5'];
      const isBox1 = boxShareCodeArr.some((item) => {
        const boxShareCode = $.getdata(item);
        return (boxShareCode !== undefined && boxShareCode !== null && boxShareCode !== '');
      });
      const isBox2 = boxShareCodeArr2.some((item) => {
        const boxShareCode = $.getdata(item);
        return (boxShareCode !== undefined && boxShareCode !== null && boxShareCode !== '');
      });
      isBox = isBox1 ? isBox1 : isBox2;
      if (isBox1) {
        let temp = [];
        for (const item of boxShareCodeArr) {
          if ($.getdata(item)) {
            temp.push($.getdata(item))
          }
        }
        jdPetShareArr.push(temp.join('@'));
      }
      if (isBox2) {
        let temp = [];
        for (const item of boxShareCodeArr2) {
          if ($.getdata(item)) {
            temp.push($.getdata(item))
          }
        }
        jdPetShareArr.push(temp.join('@'));
      }
    }
    console.log(`jdPetShareArr::${JSON.stringify(jdPetShareArr)}`)
    console.log(`jdPetShareArr账号长度::${jdPetShareArr.length}`)
    resolve()
  })
}
// 请求
async function request(function_id, body = {}) {
  await $.wait(3000); //歇口气儿, 不然会报操作频繁
  return new Promise((resolve, reject) => {
    $.get(taskurl(function_id, body), (err, resp, data) => {
      try {
        if (err) {
          console.log('\n东东萌宠: API查询请求失败 ‼️‼️');
          $.logErr(err);
        } else {
          data = JSON.parse(data);
        }
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve(data)
      }
    })
  })
}
function taskurl(function_id, body = {}) {
  return {
    url: `${JD_API_HOST}?functionId=${function_id}&appid=wh5&loginWQBiz=pet-town&body=${escape(JSON.stringify(body))}`,
    headers: {
      Cookie: cookie,
      UserAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1`,
    }
  };
}

// prettier-ignore
function Env(t,s){class e{constructor(t){this.env=t}send(t,s="GET"){t="string"==typeof t?{url:t}:t;let e=this.get;return"POST"===s&&(e=this.post),new Promise((s,i)=>{e.call(this,t,(t,e,o)=>{t?i(t):s(e)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,s){this.name=t,this.http=new e(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,s),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,s=null){try{return JSON.parse(t)}catch{return s}}toStr(t,s=null){try{return JSON.stringify(t)}catch{return s}}getjson(t,s){let e=s;const i=this.getdata(t);if(i)try{e=JSON.parse(this.getdata(t))}catch{}return e}setjson(t,s){try{return this.setdata(JSON.stringify(t),s)}catch{return!1}}getScript(t){return new Promise(s=>{this.get({url:t},(t,e,i)=>s(i))})}runScript(t,s){return new Promise(e=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let o=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");o=o?1*o:20,o=s&&s.timeout?s.timeout:o;const[h,a]=i.split("@"),r={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:o},headers:{"X-Key":h,Accept:"*/*"}};this.post(r,(t,s,i)=>e(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s);if(!e&&!i)return{};{const i=e?t:s;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s),o=JSON.stringify(this.data);e?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(s,o):this.fs.writeFileSync(t,o)}}lodash_get(t,s,e){const i=s.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return e;return o}lodash_set(t,s,e){return Object(t)!==t?t:(Array.isArray(s)||(s=s.toString().match(/[^.[\]]+/g)||[]),s.slice(0,-1).reduce((t,e,i)=>Object(t[e])===t[e]?t[e]:t[e]=Math.abs(s[i+1])>>0==+s[i+1]?[]:{},t)[s[s.length-1]]=e,t)}getdata(t){let s=this.getval(t);if(/^@/.test(t)){const[,e,i]=/^@(.*?)\.(.*?)$/.exec(t),o=e?this.getval(e):"";if(o)try{const t=JSON.parse(o);s=t?this.lodash_get(t,i,""):s}catch(t){s=""}}return s}setdata(t,s){let e=!1;if(/^@/.test(s)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(s),h=this.getval(i),a=i?"null"===h?null:h||"{}":"{}";try{const s=JSON.parse(a);this.lodash_set(s,o,t),e=this.setval(JSON.stringify(s),i)}catch(s){const h={};this.lodash_set(h,o,t),e=this.setval(JSON.stringify(h),i)}}else e=this.setval(t,s);return e}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,s){return this.isSurge()||this.isLoon()?$persistentStore.write(t,s):this.isQuanX()?$prefs.setValueForKey(t,s):this.isNode()?(this.data=this.loaddata(),this.data[s]=t,this.writedata(),!0):this.data&&this.data[s]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,s=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?$httpClient.get(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status),s(t,e,i)}):this.isQuanX()?$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t)):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,s)=>{try{const e=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(e,null),s.cookieJar=this.ckjar}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t)))}post(t,s=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())$httpClient.post(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status),s(t,e,i)});else if(this.isQuanX())t.method="POST",$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t));else if(this.isNode()){this.initGotEnv(t);const{url:e,...i}=t;this.got.post(e,i).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t))}}time(t){let s={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in s)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?s[e]:("00"+s[e]).substr((""+s[e]).length)));return t}msg(s=t,e="",i="",o){const h=t=>!t||!this.isLoon()&&this.isSurge()?t:"string"==typeof t?this.isLoon()?t:this.isQuanX()?{"open-url":t}:void 0:"object"==typeof t&&(t["open-url"]||t["media-url"])&&(this.isLoon()||this.isQuanX())?t:void 0;this.isMute||(this.isSurge()||this.isLoon()?$notification.post(s,e,i,h(o)):this.isQuanX()&&$notify(s,e,i,h(o)));let a=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];a.push(s),e&&a.push(e),i&&a.push(i),console.log(a.join("\n")),this.logs=this.logs.concat(a)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,s){const e=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();e?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(s=>setTimeout(s,t))}done(t={}){const s=(new Date).getTime(),e=(s-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${e} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,s)}