export const CONFIG = {
  particleCount: 1500,
  photoCount: 40,
  treeHeight: 25,
  treeRadius: 10,
  explodeRadius: 30,
  carouselRadius: 20,
  colors: [0xff0000, 0x00ff00, 0xffd700, 0xffffff],
  decoColors: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff],
  snowCount: 1000,
  loveQuotes: [
      "爱你 是不分昼夜",
      "想你 是每分每秒",
      "陪你 是岁岁年年",
      "有你 是此生最幸",
      "金龙 ❤ 王瑞琪"
  ],
  defaultPhotoUrl: (id: number) => `https://picsum.photos/id/${10 + id}/300/300`
};

export const MEDIAPIPE_URLS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"
];
