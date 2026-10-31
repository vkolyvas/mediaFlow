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

// Where each scene's content sits in the frame, measured from the capture by
// lib/vertical-frames.mjs. The 9:16 vertical pushes its view toward it.
const attachVerticalFrames = async (storyboard: Storyboard): Promise<Storyboard> => {
  const measured: Record<
    string,
    {target: number; subject: number | null; window: [number, number]; backdrop?: string}
  > = await fetch(staticFile('vertical-frames.json'))
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((s) =>
      measured[s.id]
        ? {...s, verticalFrame: measured[s.id], verticalBackdrop: measured[s.id].backdrop}
        : s,
    ),
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
