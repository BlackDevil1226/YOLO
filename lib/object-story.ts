import type { Detection } from './yolo';

const CLASS_NAMES_ZH: Record<string, string> = {
  person: '人',
  bicycle: '自行車',
  car: '汽車',
  motorcycle: '機車',
  airplane: '飛機',
  bus: '公車',
  train: '火車',
  truck: '卡車',
  boat: '船',
  'traffic light': '紅綠燈',
  'fire hydrant': '消防栓',
  'stop sign': '停止標誌',
  'parking meter': '停車計時器',
  bench: '長椅',
  bird: '鳥',
  cat: '貓',
  dog: '狗',
  horse: '馬',
  sheep: '羊',
  cow: '牛',
  elephant: '大象',
  bear: '熊',
  zebra: '斑馬',
  giraffe: '長頸鹿',
  backpack: '背包',
  umbrella: '雨傘',
  handbag: '手提包',
  tie: '領帶',
  suitcase: '行李箱',
  frisbee: '飛盤',
  skis: '滑雪板',
  snowboard: '單板滑雪板',
  'sports ball': '球',
  kite: '風箏',
  'baseball bat': '棒球棒',
  'baseball glove': '棒球手套',
  skateboard: '滑板',
  surfboard: '衝浪板',
  'tennis racket': '網球拍',
  bottle: '瓶子',
  'wine glass': '高腳杯',
  cup: '杯子',
  fork: '叉子',
  knife: '刀子',
  spoon: '湯匙',
  bowl: '碗',
  banana: '香蕉',
  apple: '蘋果',
  sandwich: '三明治',
  orange: '柳橙',
  broccoli: '花椰菜',
  carrot: '紅蘿蔔',
  'hot dog': '熱狗',
  pizza: '披薩',
  donut: '甜甜圈',
  cake: '蛋糕',
  chair: '椅子',
  couch: '沙發',
  'potted plant': '盆栽',
  bed: '床',
  'dining table': '餐桌',
  toilet: '馬桶',
  tv: '電視',
  laptop: '筆電',
  mouse: '滑鼠',
  remote: '遙控器',
  keyboard: '鍵盤',
  'cell phone': '手機',
  microwave: '微波爐',
  oven: '烤箱',
  toaster: '烤麵包機',
  sink: '水槽',
  refrigerator: '冰箱',
  book: '書',
  clock: '時鐘',
  vase: '花瓶',
  scissors: '剪刀',
  'teddy bear': '泰迪熊',
  'hair drier': '吹風機',
  toothbrush: '牙刷',
};

export interface StoryObject {
  classId: number;
  label: string;
  labelEn: string;
  count: number;
  confidence: number;
}

export interface ObjectStory {
  title: string;
  paragraphs: string[];
  titleEn: string;
  paragraphsEn: string[];
  objects: StoryObject[];
}

export function generateObjectStory(detections: Detection[]): ObjectStory {
  const objects = summarizeObjects(detections).slice(0, 6);

  if (objects.length === 0) {
    return {
      title: '《透明怪獸的完美偽裝》',
      paragraphs: [
        '快門按下的那一刻，辨識器把每個角落都看了一遍，卻找不到任何熟悉的物體。這只能說明一件事：透明怪獸的偽裝成功了。',
        '牠屏住呼吸躲在畫面裡，直到相機移開才小聲歡呼。這張看似空白的照片，也因此成了怪獸世界最得意的一張通緝照。',
      ],
      titleEn: 'The Invisible Monster’s Perfect Disguise',
      paragraphsEn: [
        'The moment the shutter clicked, the detector searched every corner but could not find a single familiar object. There was only one possible explanation: the invisible monster’s disguise had worked perfectly.',
        'It held its breath inside the frame and waited until the camera moved away before celebrating. That seemingly empty picture soon became the proudest wanted poster in the monster world.',
      ],
      objects,
    };
  }

  const hero = objects[0];
  const heroName = hero.label;
  const cast = new Intl.ListFormat('zh-TW', { type: 'conjunction' }).format(
    objects.map(formatStoryObject),
  );
  const supportingCast = objects.slice(1).map(formatStoryObject);
  const castEn = new Intl.ListFormat('en', { type: 'conjunction' }).format(
    objects.map(formatStoryObjectEn),
  );
  const supportingCastEn = objects.slice(1).map(formatStoryObjectEn);
  const castVerbEn = objects.reduce((total, object) => total + object.count, 0) > 1 ? 'were' : 'was';
  const companions = supportingCast.length
    ? new Intl.ListFormat('zh-TW', { type: 'conjunction' }).format(supportingCast)
    : '自己的影子';
  const companionsEn = supportingCastEn.length
    ? new Intl.ListFormat('en', { type: 'conjunction' }).format(supportingCastEn)
    : 'their own shadow';
  const heroNameEn = hero.count > 1 ? `${hero.count} ${pluralize(hero.labelEn)}` : `the ${hero.labelEn}`;
  const seed = objects.reduce(
    (total, object) => total + object.classId * 17 + object.count * 7,
    detections.length,
  );

  const stories = [
    {
      title: `《${heroName}與消失的下午三點》`,
      paragraphs: [
        `快門按下時，畫面裡的${cast}正召開一場極度機密的會議。${heroName}宣布下午三點不見了，而${companions}都堅稱自己最後一次看見它，是在午餐和打瞌睡之間。`,
        `大家追著影子找了半天，最後才發現下午三點一直躲在時鐘背後。${heroName}沒有生氣，只要求它下次遲到時記得帶點心；於是這場危機，以一場臨時下午茶和平落幕。`,
      ],
      titleEn: `${titleCase(heroNameEn)} and the Missing Three O’Clock`,
      paragraphsEn: [
        `When the shutter clicked, ${castEn} ${castVerbEn} holding a top-secret meeting. ${titleCase(heroNameEn)} announced that three o’clock had disappeared, while ${companionsEn} insisted they had last seen it somewhere between lunch and a nap.`,
        `After chasing shadows for half the day, they discovered three o’clock hiding behind a clock. ${titleCase(heroNameEn)} was not angry and merely asked it to bring snacks the next time it was late. The crisis ended peacefully with an emergency tea party.`,
      ],
    },
    {
      title: `《${heroName}的月球外送任務》`,
      paragraphs: [
        `照片中的${cast}看起來若無其事，其實正在準備史上第一次月球外送。${heroName}負責當隊長，${companions}則負責一項更重要的工作：確保點心不會在起飛前被吃光。`,
        `火箭最後沒有升空，因為大家發現導航地址寫著「月亮旁邊那一戶」。但他們仍把任務判定為成功——至少點心安全抵達了客廳。`,
      ],
      titleEn: `${titleCase(heroNameEn)}’s Moon Delivery Mission`,
      paragraphsEn: [
        `${titleCase(castEn)} in the photo looked perfectly ordinary, but they were preparing the first delivery to the Moon. ${titleCase(heroNameEn)} was the captain, while ${companionsEn} had an even more important job: making sure the snacks survived until launch.`,
        'The rocket never left the ground because the navigation address only said, “the house next to the Moon.” They still declared the mission a success—at least the snacks made it safely to the living room.',
      ],
    },
    {
      title: `《${heroName}開了一間奇怪公司》`,
      paragraphs: [
        `${heroName}決定創業，還邀請${companions}一起加入。公司的服務只有一項：替無聊的星期一加上一點意外。照片裡的${cast}，就是他們第一次開會時的全體員工。`,
        `第一位客人要求「讓今天有趣一點」，於是大家把會議改成尋寶、把午餐改成頒獎典禮，還頒給自己一座「準時下班獎」。公司沒有賺到錢，卻得到五星好評。`,
      ],
      titleEn: `${titleCase(heroNameEn)} Starts a Very Strange Company`,
      paragraphsEn: [
        `${titleCase(heroNameEn)} decided to start a company and invited ${companionsEn} to join. It offered just one service: adding a little surprise to boring Mondays. ${titleCase(castEn)} made up the entire staff at their first meeting.`,
        'Their first customer asked for a more interesting day, so the team turned the meeting into a treasure hunt and lunch into an awards ceremony. They even gave themselves a “Left Work on Time” trophy. The company made no money, but it earned five stars.',
      ],
    },
    {
      title: `《${heroName}和不能說的暗號》`,
      paragraphs: [
        `在相機看見的${cast}之中，只有${heroName}知道秘密暗號。${companions}輪流猜了「芝麻開門」、「今天放假」和「晚餐加菜」，門卻始終沒有打開。`,
        `直到有人不小心打了個噴嚏，門才慢慢滑開。原來暗號一直都是「哈啾」；大家立刻決定保守秘密，並在門口放了一盒衛生紙。`,
      ],
      titleEn: `${titleCase(heroNameEn)} and the Unmentionable Password`,
      paragraphsEn: [
        `Among everything seen by the camera, only ${heroNameEn} knew the secret password. ${titleCase(companionsEn)} tried “open sesame,” “today is a holiday,” and “extra dessert,” but the door refused to move.`,
        'Then someone accidentally sneezed and the door slowly opened. The password had been “achoo” all along. Everyone promised to keep it secret—and placed a box of tissues beside the entrance.',
      ],
    },
  ];

  const selectedStory = stories[seed % stories.length];
  return { ...selectedStory, objects };
}

function summarizeObjects(detections: Detection[]) {
  const grouped = new Map<number, StoryObject>();

  for (const detection of detections) {
    const existing = grouped.get(detection.class_id);
    if (existing) {
      existing.count += 1;
      existing.confidence = Math.max(existing.confidence, detection.confidence);
      continue;
    }

    grouped.set(detection.class_id, {
      classId: detection.class_id,
      label: CLASS_NAMES_ZH[detection.class_name] ?? detection.class_name,
      labelEn: detection.class_name,
      count: 1,
      confidence: detection.confidence,
    });
  }

  return [...grouped.values()].sort(
    (a, b) => b.confidence - a.confidence || b.count - a.count,
  );
}

function formatStoryObject(object: StoryObject) {
  return object.count > 1 ? `${object.count} 個${object.label}` : `一個${object.label}`;
}

function formatStoryObjectEn(object: StoryObject) {
  return object.count > 1 ? `${object.count} ${pluralize(object.labelEn)}` : `one ${object.labelEn}`;
}

function pluralize(label: string) {
  const irregular: Record<string, string> = {
    person: 'people',
    sheep: 'sheep',
    scissors: 'scissors',
  };
  if (irregular[label]) return irregular[label];
  if (label.endsWith('s')) return `${label}es`;
  if (label.endsWith('y')) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

function titleCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
