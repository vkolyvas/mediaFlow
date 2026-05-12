"""
FFmpeg filter graph builder.

Builds filter graphs dynamically from scene manifests.
Never hardcodes timelines — always generates filter graphs from manifest data.
"""

from .manifest import SceneManifest, Scene


class FilterGraph:
    def __init__(self, manifest: SceneManifest):
        self.manifest = manifest
        self.inputs: list[str] = []
        self.filters: list[str] = []
        self.output_labels: list[str] = []

    def add_input(self, label: str, path: str):
        self.inputs.append(f"-i '{path}'")
        self.inputs.append(f"-f lavfi -t 0.01 -i 'anullsrc=r=48000:cl=2'")
        return len(self.inputs) // 2

    def build(self) -> str:
        raise NotImplementedError


class SceneComposer:
    """
    Composes scenes into a single video using FFmpeg filter_complex.

    Strategy:
    1. Pad/crop each input to target resolution
    2. Overlay with z-index ordering
    3. Trim to scene timing
    4. Concatenate
    """

    def __init__(self, manifest: SceneManifest):
        self.manifest = manifest
        self.spec = manifest

    def compose(self, asset_paths: dict[str, str]) -> list[str]:
        """
        Generate FFmpeg CLI args for composing all scenes.

        asset_paths: {scene_id: file_path}
        Returns: list of ffmpeg argument parts
        """
        args = []
        for scene in self.manifest.timeline:
            if scene.type == "avatar" and scene.asset:
                path = asset_paths.get(scene.asset, scene.asset)
                args.extend(self._avatar_scene(scene, path))
            elif scene.type == "broll" and scene.asset:
                path = asset_paths.get(scene.asset, scene.asset)
                args.extend(self._broll_scene(scene, path))
            elif scene.type == "silence":
                args.extend(self._silence_scene(scene))
            elif scene.type == "color":
                args.extend(self._color_scene(scene))
        return args

    def _avatar_scene(self, scene: Scene, path: str) -> list[str]:
        w, h = self.manifest.resolution
        return [
            "-i", path,
            "-filter_complex",
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1:1[v]",
            "-map", "[v]",
            "-t", str(scene.end - scene.start),
            "-r", str(self.manifest.fps),
        ]

    def _broll_scene(self, scene: Scene, path: str) -> list[str]:
        w, h = self.manifest.resolution
        return [
            "-i", path,
            "-filter_complex",
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1:1[v]",
            "-map", "[v]",
            "-t", str(scene.end - scene.start),
            "-r", str(self.manifest.fps),
        ]

    def _silence_scene(self, scene: Scene) -> list[str]:
        duration = scene.end - scene.start
        return [
            "-f", "lavfi",
            "-i", f"color=c=black:s=1x1:d={duration}:r={self.manifest.fps}",
        ]

    def _color_scene(self, scene: Scene) -> list[str]:
        color = scene.asset or "#000000"
        duration = scene.end - scene.start
        return [
            "-f", "lavfi",
            "-i", f"color=c={color}:s=1x1:d={duration}:r={self.manifest.fps}",
        ]


def build_concat_filter(timeline: list[Scene], fps: int) -> tuple[str, list[str]]:
    """
    Build FFmpeg command for assembling scenes in timeline order.

    Returns (filter_complex_str, cli_args_list)
    """
    n = len(timeline)
    if n == 0:
        return "", []

    concat = f"concat=n={n}:v=1:a=0[vout]" if n > 1 else ""

    args = []
    for scene in timeline:
        if scene.type in ("avatar", "broll") and scene.asset:
            args.extend(["-i", scene.asset])
        elif scene.type == "silence":
            duration = scene.end - scene.start
            args.extend(["-f", "lavfi", "-i", f"color=c=black:s=1x1:d={duration}:r={fps}"])
        elif scene.type == "color":
            color = scene.asset or "#000000"
            duration = scene.end - scene.start
            args.extend(["-f", "lavfi", "-i", f"color=c={color}:s=1x1:d={duration}:r={fps}"])

    if concat:
        args.extend(["-filter_complex", concat, "-map", "[vout]"])

    return concat, args
