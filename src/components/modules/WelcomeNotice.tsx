type WelcomeNoticeProps = {
  onAccept: () => void;
};

const features = [
  '每日计划：记录今天要做的事，支持勾选完成、拖拽排序、模板导入和未完成任务自动结转。',
  '下班倒计时：看清距离午休、下午上班和下班还有多久，也会给你一点不那么冷冰冰的吐槽。',
  '小说阅读：导入本地文本，记住上次阅读位置，空闲时可以快速接着看。',
  '照片轮播：导入喜欢的照片，自己调整取景区域、横竖图和轮播时间。',
  '临时剪贴板岛：批量采集文字或图片，之后按需粘贴，适合录单、发货和整理资料。',
  '办公小工具：计算器、文件命名助手、账号密码库、数据备份迁移和外观自定义。',
];

export function WelcomeNotice({ onAccept }: WelcomeNoticeProps) {
  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <span className="welcome-kicker">首次使用须知</span>
        <h2 id="welcome-title">感谢使用梨子开发的桌面灵动岛软件</h2>
        <p>
          这个软件是为了让日常办公少一点来回切窗口的烦躁，多一点顺手和轻松。它不一定一开始就完美，但每个功能都会尽量围绕“真的能帮你省事”去做。
          (｡･ω･｡)
        </p>

        <div className="welcome-feature-list">
          {features.map((feature) => (
            <div key={feature} className="welcome-feature">
              <span aria-hidden="true">✓</span>
              <p>{feature}</p>
            </div>
          ))}
        </div>

        <p className="welcome-footnote">
          如果你有定制功能需求、遇到异常问题，或者觉得某个功能用起来不顺畅，都可以联系邮箱：lijingsheng02@gmail.com。感谢你的使用和反馈，愿它能真的帮你少受一点工作折磨。
          (´･ᴗ･`)
        </p>
        <button type="button" onClick={onAccept}>
          开始使用
        </button>
      </div>
    </div>
  );
}
