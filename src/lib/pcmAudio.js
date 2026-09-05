const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

const CAPTURE_WORKLET = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      this.port.postMessage(channel.slice());
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCaptureProcessor);
`;

function floatToPcm16Base64(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function resample(float32, fromRate, toRate) {
  if (!float32.length || fromRate === toRate) return float32;
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(float32.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const idx = i * ratio;
    const i0 = Math.min(Math.floor(idx), Math.max(float32.length - 1, 0));
    const frac = idx - i0;
    const s0 = float32[i0] || 0;
    const s1 = float32[Math.min(i0 + 1, float32.length - 1)] || 0;
    out[i] = s0 + (s1 - s0) * frac;
  }
  return out;
}

export function base64ToInt16(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  const even = len - (len % 2);
  return new Int16Array(bytes.buffer, bytes.byteOffset, even / 2);
}

export function createPcmPlayer() {
  const ctx = new AudioContext({ sampleRate: OUTPUT_RATE });
  let nextTime = 0;
  const sources = new Set();

  async function playBase64Pcm16(b64) {
    await resume();
    const int16 = base64ToInt16(b64);
    if (!int16.length) return;
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    const samples = resample(float32, OUTPUT_RATE, ctx.sampleRate || OUTPUT_RATE);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate || OUTPUT_RATE);
    buffer.copyToChannel(samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(nextTime, ctx.currentTime);
    src.start(startAt);
    nextTime = startAt + buffer.duration;
    sources.add(src);
    src.onended = () => sources.delete(src);
  }

  async function resume() {
    if (ctx.state === "suspended") await ctx.resume();
  }

  function interrupt() {
    sources.forEach((s) => {
      try { s.stop(); } catch {}
    });
    sources.clear();
    nextTime = ctx.currentTime;
  }

  async function destroy() {
    interrupt();
    try { await ctx.close(); } catch {}
  }

  return { playBase64Pcm16, interrupt, destroy, resume };
}

export async function startPcmCapture(stream, onPcm16Base64) {
  const ctx = new AudioContext({ sampleRate: INPUT_RATE });
  if (ctx.state === "suspended") await ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  let node;
  let fallbackProcessor;

  const handleSamples = (float32) => {
    const resampled = resample(float32, ctx.sampleRate, INPUT_RATE);
    if (!resampled.length) return;
    onPcm16Base64(floatToPcm16Base64(resampled));
  };

  try {
    const blob = new Blob([CAPTURE_WORKLET], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    node = new AudioWorkletNode(ctx, "pcm-capture");
    node.port.onmessage = (event) => handleSamples(event.data);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
  } catch {
    fallbackProcessor = ctx.createScriptProcessor(4096, 1, 1);
    fallbackProcessor.onaudioprocess = (event) => {
      handleSamples(event.inputBuffer.getChannelData(0));
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(fallbackProcessor);
    fallbackProcessor.connect(mute);
    mute.connect(ctx.destination);
  }

  return {
    async stop() {
      try { source.disconnect(); } catch {}
      try { if (node) node.disconnect(); } catch {}
      try { if (fallbackProcessor) fallbackProcessor.disconnect(); } catch {}
      try { await ctx.close(); } catch {}
    },
  };
}
