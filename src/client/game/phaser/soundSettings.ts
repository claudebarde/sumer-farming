type VolumeSound = { readonly volume?: number; setVolume: (volume: number) => unknown };
type LoopSound = { readonly loop?: boolean; setLoop: (loop: boolean) => unknown };
// Weak fallback caches support sound adapters without getters, without retaining
// destroyed sounds. Phaser's getters take precedence, including changes by fades.
const volumes = new WeakMap<VolumeSound, number>();
const loops = new WeakMap<LoopSound, boolean>();

export const syncSoundVolume = (sound: VolumeSound, volume: number) => {
  if ((sound.volume ?? volumes.get(sound)) === volume) return;
  sound.setVolume(volume);
  volumes.set(sound, volume);
};

export const syncSoundLoop = (sound: LoopSound, loop: boolean) => {
  if ((sound.loop ?? loops.get(sound)) === loop) return;
  sound.setLoop(loop);
  loops.set(sound, loop);
};
