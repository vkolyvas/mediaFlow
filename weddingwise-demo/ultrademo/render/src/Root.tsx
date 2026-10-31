import {Composition, staticFile} from 'remotion';
import {CaptionStyle, Demo, FPS, Layout, Storyboard, totalFrames} from './Demo';

type Props = {
  storyboard: Storyboard | null;
  layout?: Layout;
  captions?: boolean;
  audio?: boolean;
  caption?: CaptionStyle;
  // Feed cut: when set, only these scene ids are rendered (the rest of the
  // storyboard is dropped) so the result fits Instagram's 60 s feed limit.
  sceneIds?: string[];
};

// The render runs with --public-dir projects/<name>/assets, so the storyboard
// and all asset paths resolve relative to that project.
const loadStoryboard = async ({props}: {props: Props}) => {
  const raw: Storyboard = await fetch(staticFile('storyboard.json')).then((r) => r.json());
  // The feed cut drops scenes BEFORE the timeline is measured, so the frame
  // count matches what actually plays.
  const cut: Storyboard = props.sceneIds
    ? {...raw, scenes: raw.scenes.filter((s) => props.sceneIds!.includes(s.id))}
    : raw;
  const storyboard = await attachVerticalFrames(cut);
  return {durationInFrames: totalFrames(storyboard), props: {...props, storyboard}};
};

// The 9:16 window cut out of each capture, prepared by lib/vertical-crops.mjs.
// The renderer draws these 1:1 - the crop happens offline, in ffmpeg.
const attachVerticalFrames = async (storyboard: Storyboard): Promise<Storyboard> => {
  const measured: Record<
    string,
    {
      cropX: number;
      cropW: number;
      cropH: number;
      asset?: string;
      still?: string;
      isVideo?: boolean;
      push?: number;
      duration?: number;
    }
  > = await fetch(staticFile('vertical-frames.json'))
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((s) => {
      const m = measured[s.id];
      if (!m || !m.asset || !m.still) return s;
      return {
        ...s,
        verticalCut: {
          cropX: m.cropX,
          cropW: m.cropW,
          cropH: m.cropH,
          asset: m.asset,
          still: m.still,
          isVideo: Boolean(m.isVideo),
          push: m.push ?? 0,
          duration: m.duration ?? 0,
        },
      };
    }),
  };
};

const DemoWide: React.FC<Props> = (p) => (
  <Demo storyboard={p.storyboard} layout="wide" captions={p.captions ?? true} audio={p.audio ?? true} caption={p.caption} />
);
const DemoVertical: React.FC<Props> = (p) => (
  <Demo storyboard={p.storyboard} layout="vertical" captions={p.captions ?? true} audio={p.audio ?? true} caption={p.caption} />
);
const DemoPortrait: React.FC<Props> = (p) => (
  <Demo storyboard={p.storyboard} layout="portrait" captions={p.captions ?? true} audio={p.audio ?? true} caption={p.caption} />
);
const DemoSquare: React.FC<Props> = (p) => (
  <Demo storyboard={p.storyboard} layout="square" captions={p.captions ?? true} audio={p.audio ?? true} caption={p.caption} />
);

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Demo"
        component={DemoWide}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={300}
        defaultProps={{storyboard: null}}
        calculateMetadata={loadStoryboard}
      />
      <Composition
        id="DemoVertical"
        component={DemoVertical}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={300}
        defaultProps={{storyboard: null}}
        calculateMetadata={loadStoryboard}
      />
      <Composition
        id="DemoPortrait"
        component={DemoPortrait}
        width={1080}
        height={1350}
        fps={FPS}
        durationInFrames={300}
        defaultProps={{storyboard: null}}
        calculateMetadata={loadStoryboard}
      />
      <Composition
        id="DemoSquare"
        component={DemoSquare}
        width={1080}
        height={1080}
        fps={FPS}
        durationInFrames={300}
        defaultProps={{storyboard: null}}
        calculateMetadata={loadStoryboard}
      />
    </>
  );
};
