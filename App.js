/**
 * AlarmGameApp.jsx
 * App de alarma que se desactiva ganando un juego O con la voz.
 *
 * Instalación:
 *   npx create-expo-app AlarmGame
 *   cd AlarmGame
 *   npx expo install expo-speech-recognition
 *   Reemplazá App.js con este archivo.
 *
 * Permisos requeridos:
 *   Android → android/app/src/main/AndroidManifest.xml:
 *     <uses-permission android:name="android.permission.RECORD_AUDIO" />
 *   iOS → ios/AlarmGame/Info.plist:
 *     <key>NSSpeechRecognitionUsageDescription</key>
 *     <string>Necesitamos tu voz para desactivar la alarma</string>
 *     <key>NSMicrophoneUsageDescription</key>
 *     <string>Necesitamos el micrófono para escucharte</string>
 *
 *  Con Expo Go no funciona expo-speech-recognition; usá un development build:
 *    npx expo run:android   /   npx expo run:ios
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Animated, Vibration, Dimensions, Platform,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48 - 24) / 4;

// ─── CONSTANTES ────────────────────────────────────────────────────────────────

// Frase que hay que decir para desactivar la alarma con la voz.
// Podés cambiarla por lo que quieras.
const VOICE_COMMAND = 'buenos días';

const PHRASES = [
  'El que madruga gana el día',
  'Levantarse temprano es un superpoder',
  'Hoy va a ser un gran día',
  'La disciplina vence al talento',
  'Pequeños pasos, grandes logros',
];

const MEM_EMOJIS = ['🦊','🌈','🎸','🍕','🚀','🌺','🦋','🎯'];

const COLORS = {
  bg: '#1a1a2e',
  surface: '#16213e',
  card: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.12)',
  accent: '#e94560',
  success: '#1d9e75',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.5)',
  math_bg: '#0f3460',
  voice_bg: '#0d2137',
};

// ─── HOOK: RECONOCIMIENTO DE VOZ ───────────────────────────────────────────────

/**
 * Encapsula toda la lógica de expo-speech-recognition.
 * onMatch(transcript) se llama cuando se detecta el comando correcto.
 */
function useVoiceUnlock(onMatch) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Pedir permiso al montar
  useEffect(() => {
    (async () => {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setHasPermission(granted);
    })();
  }, []);

  // Resultados parciales — mostramos en tiempo real
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript ?? '';
    setTranscript(text);
    // Comparamos en minúsculas y sin tildes para mayor tolerancia
    const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const target = VOICE_COMMAND.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(target)) {
      ExpoSpeechRecognitionModule.stop();
      onMatch(text);
    }
  });

  useSpeechRecognitionEvent('start', () => { setListening(true); setError(null); });
  useSpeechRecognitionEvent('end',   () => setListening(false));
  useSpeechRecognitionEvent('error', (e) => { setError(e.message); setListening(false); });

  const start = useCallback(async () => {
    if (!hasPermission) {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setHasPermission(granted);
      if (!granted) { setError('Sin permiso de micrófono'); return; }
    }
    setTranscript('');
    setError(null);
    ExpoSpeechRecognitionModule.start({
      lang: 'es-AR',           // español argentino; cambiá por 'es-ES' si querés
      interimResults: true,
      continuous: false,
    });
  }, [hasPermission]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { listening, transcript, error, hasPermission, start, stop };
}

// ─── COMPONENTE: BOTÓN DE VOZ ──────────────────────────────────────────────────

/**
 * Botón flotante para activar/desactivar el micrófono.
 * Se muestra en la pantalla de alarma (antes de elegir juego).
 */
function VoiceButton({ onSuccess }) {
  const micScale = useRef(new Animated.Value(1)).current;
  const [matched, setMatched] = useState(false);

  const handleMatch = useCallback((text) => {
    setMatched(true);
    Vibration.vibrate([60, 60, 60]);
    setTimeout(onSuccess, 800);
  }, [onSuccess]);

  const { listening, transcript, error, start, stop } = useVoiceUnlock(handleMatch);

  // Animación de pulso mientras escucha
  useEffect(() => {
    if (listening) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(micScale, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(micScale, { toValue: 1,   duration: 500, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      micScale.setValue(1);
    }
  }, [listening]);

  const toggle = () => listening ? stop() : start();

  return (
    <View style={{ alignItems: 'center', marginTop: 20 }}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.8}>
        <Animated.View style={[
          vStyle.micBtn,
          listening && vStyle.micBtnActive,
          matched && vStyle.micBtnSuccess,
          { transform: [{ scale: micScale }] },
        ]}>
          <Text style={{ fontSize: 32 }}>{matched ? '✅' : listening ? '🎙️' : '🎤'}</Text>
        </Animated.View>
      </TouchableOpacity>

      <Text style={[vStyle.hint, { marginTop: 10 }]}>
        {matched
          ? '¡Comando reconocido!'
          : listening
          ? `Escuchando... di "${VOICE_COMMAND}"`
          : `O decí "${VOICE_COMMAND}"`}
      </Text>

      {transcript !== '' && !matched && (
        <Text style={vStyle.transcript} numberOfLines={2}>"{transcript}"</Text>
      )}

      {error && (
        <Text style={vStyle.errorText}>⚠ {error}</Text>
      )}
    </View>
  );
}

const vStyle = StyleSheet.create({
  micBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: 'rgba(233,69,96,0.2)',
    borderColor: '#e94560',
  },
  micBtnSuccess: {
    backgroundColor: 'rgba(29,158,117,0.25)',
    borderColor: '#1d9e75',
  },
  hint:       { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },
  transcript: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 6, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 24 },
  errorText:  { color: '#f09595', fontSize: 12, marginTop: 6, textAlign: 'center' },
});

// ─── PANTALLA: ALARMA ──────────────────────────────────────────────────────────

function AlarmScreen({ onDisarm, onVoiceDisarm }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setTime(`${h}:${m}`);
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Vibration.vibrate([500, 500, 500, 500], true);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => { anim.stop(); Vibration.cancel(); };
  }, []);

  return (
    <View style={[s.screen, { backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={s.alarmTime}>{time}</Text>
      <Text style={[s.muted, { marginBottom: 40 }]}>Buenos días 🌅</Text>

      <Animated.View style={[s.alarmRing, { transform: [{ scale: pulse }] }]}>
        <Text style={{ fontSize: 48 }}>🔔</Text>
      </Animated.View>

      <TouchableOpacity style={[s.btnPrimary, { marginTop: 40 }]} onPress={onDisarm} activeOpacity={0.8}>
        <Text style={s.btnText}>▶ Desactivar con un juego</Text>
      </TouchableOpacity>

      {/* ─── BOTÓN DE VOZ ─── */}
      <View style={s.divider}>
        <View style={s.divLine} /><Text style={s.divText}>o</Text><View style={s.divLine} />
      </View>
      <VoiceButton onSuccess={onVoiceDisarm} />
    </View>
  );
}

// ─── PANTALLA: SELECTOR ────────────────────────────────────────────────────────

function GameSelector({ onSelect }) {
  const games = [
    { id: 'math',   emoji: '🧮', name: 'Matemáticas', desc: 'Respondé 5 operaciones',     diff: 'Medio',   diffColor: '#85b7eb' },
    { id: 'memory', emoji: '🃏', name: 'Memoria',      desc: 'Encontrá los 8 pares',       diff: 'Fácil',   diffColor: '#5dcaa5' },
    { id: 'typing', emoji: '⌨️', name: 'Escribir',     desc: 'Tipeá exactamente la frase', diff: 'Difícil', diffColor: '#f09595' },
  ];
  return (
    <View style={[s.screen, { backgroundColor: COLORS.surface }]}>
      <Text style={[s.title, { marginTop: 24 }]}>¿Con qué te despertás?</Text>
      <Text style={s.muted}>Completá el desafío para apagar la alarma</Text>
      <View style={{ marginTop: 24 }}>
        {games.map(g => (
          <TouchableOpacity key={g.id} style={s.gameCard} onPress={() => onSelect(g.id)} activeOpacity={0.7}>
            <Text style={{ fontSize: 28 }}>{g.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.gameName}>{g.name}</Text>
              <Text style={[s.muted, { fontSize: 13, marginTop: 2 }]}>{g.desc}</Text>
            </View>
            <View style={[s.diffBadge, { borderColor: g.diffColor }]}>
              <Text style={{ color: g.diffColor, fontSize: 12 }}>{g.diff}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── JUEGO: MATEMÁTICAS ────────────────────────────────────────────────────────

function MathGame({ onWin, onBack }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [question, setQuestion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const TOTAL = 5;

  const generateQuestion = useCallback(() => {
    const ops = [
      { sym: '+', fn: (a, b) => a + b },
      { sym: '−', fn: (a, b) => a - b },
      { sym: '×', fn: (a, b) => a * b },
    ];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b;
    if      (op.sym === '×') { a = Math.floor(Math.random() * 9) + 2; b = Math.floor(Math.random() * 9) + 2; }
    else if (op.sym === '−') { a = Math.floor(Math.random() * 50) + 20; b = Math.floor(Math.random() * a); }
    else                     { a = Math.floor(Math.random() * 49) + 1; b = Math.floor(Math.random() * 49) + 1; }
    const correct = op.fn(a, b);
    const opts = new Set([correct]);
    while (opts.size < 4) {
      const delta = Math.round((Math.random() - 0.5) * 20) || 1;
      opts.add(correct + delta);
    }
    setQuestion({ text: `${a} ${op.sym} ${b}`, correct, opts: [...opts].sort(() => Math.random() - 0.5) });
    setFeedback(null);
  }, []);

  useEffect(() => { generateQuestion(); }, []);

  const answer = (val, idx) => {
    if (feedback !== null) return;
    const isCorrect = val === question.correct;
    setFeedback({ idx, correct: isCorrect });
    Vibration.vibrate(isCorrect ? 60 : [80, 80, 80]);
    if (isCorrect) {
      const next = score + 1;
      if (next >= TOTAL) { setTimeout(onWin, 600); return; }
      setScore(next);
      setTimeout(generateQuestion, 600);
    } else {
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) { setTimeout(onWin, 1000); return; }
      setTimeout(generateQuestion, 900);
    }
  };

  if (!question) return <View style={[s.screen, { backgroundColor: COLORS.math_bg }]} />;

  return (
    <View style={[s.screen, { backgroundColor: COLORS.math_bg }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack}><Text style={s.backBtn}>← Volver</Text></TouchableOpacity>
        <Text style={s.text}>{'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</Text>
      </View>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${(score / TOTAL) * 100}%` }]} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={s.mathQ}>{question.text}</Text>
        <View style={s.optsGrid}>
          {question.opts.map((opt, i) => {
            let bg = COLORS.card;
            if (feedback !== null) {
              if (opt === question.correct) bg = COLORS.success + '60';
              else if (i === feedback.idx && !feedback.correct) bg = '#a32d2d60';
            }
            return (
              <TouchableOpacity
                key={i} style={[s.optBtn, { backgroundColor: bg }]}
                onPress={() => answer(opt, i)} activeOpacity={0.7}
              >
                <Text style={[s.text, { fontSize: 24 }]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── JUEGO: MEMORIA ────────────────────────────────────────────────────────────

function MemoryGame({ onWin, onBack }) {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [locked, setLocked] = useState(false);
  const [pairs, setPairs] = useState(0);

  useEffect(() => {
    const deck = [...MEM_EMOJIS, ...MEM_EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji }));
    setCards(deck);
  }, []);

  const flip = (card) => {
    if (locked || flipped.some(f => f.id === card.id) || matched.has(card.id)) return;
    const next = [...flipped, card];
    setFlipped(next);
    if (next.length === 2) {
      setLocked(true);
      if (next[0].emoji === next[1].emoji) {
        const nm = new Set(matched);
        nm.add(next[0].id); nm.add(next[1].id);
        setMatched(nm);
        const nextPairs = pairs + 1;
        setPairs(nextPairs);
        setFlipped([]);
        setLocked(false);
        if (nextPairs === MEM_EMOJIS.length) setTimeout(onWin, 400);
      } else {
        setTimeout(() => { setFlipped([]); setLocked(false); }, 800);
      }
    }
  };

  const isFlipped = (card) => flipped.some(f => f.id === card.id) || matched.has(card.id);

  return (
    <View style={[s.screen, { backgroundColor: COLORS.bg }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack}><Text style={s.backBtn}>← Volver</Text></TouchableOpacity>
        <Text style={s.muted}>{pairs} / {MEM_EMOJIS.length} pares</Text>
      </View>
      <Text style={[s.title, { marginBottom: 20 }]}>Memoria</Text>
      <View style={s.memGrid}>
        {cards.map(card => (
          <TouchableOpacity key={card.id} style={[s.memCard, matched.has(card.id) && s.memMatched]} onPress={() => flip(card)} activeOpacity={0.8}>
            <Text style={{ fontSize: 26, opacity: isFlipped(card) ? 1 : 0 }}>{card.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── JUEGO: ESCRITURA ──────────────────────────────────────────────────────────

function TypingGame({ onWin, onBack }) {
  const [target] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  const [typed, setTyped] = useState('');

  const onChange = (val) => {
    setTyped(val);
    if (val === target) { Vibration.vibrate(100); setTimeout(onWin, 300); }
  };

  const chars = target.split('').map((ch, i) => {
    let color = COLORS.muted;
    if (i < typed.length) color = typed[i] === ch ? COLORS.success : COLORS.accent;
    return <Text key={i} style={{ color, fontSize: 22, fontWeight: '500' }}>{ch}</Text>;
  });

  return (
    <View style={[s.screen, { backgroundColor: COLORS.surface }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack}><Text style={s.backBtn}>← Volver</Text></TouchableOpacity>
      </View>
      <Text style={s.title}>Escribir</Text>
      <Text style={[s.muted, { marginBottom: 24 }]}>Copiá exactamente la frase</Text>
      <View style={s.phraseBox}><Text>{chars}</Text></View>
      <TextInput
        style={s.typingInput}
        value={typed}
        onChangeText={onChange}
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
        placeholder="Escribí acá..."
        placeholderTextColor={COLORS.muted}
        autoFocus
      />
      <Text style={[s.muted, { marginTop: 12, fontSize: 13 }]}>{typed.length} / {target.length} caracteres</Text>
    </View>
  );
}

// ─── PANTALLA: ÉXITO ───────────────────────────────────────────────────────────

function SuccessScreen({ elapsed, method, onReset }) {
  const byVoice = method === 'voice';
  return (
    <View style={[s.screen, { backgroundColor: COLORS.math_bg, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: 72, marginBottom: 16 }}>{byVoice ? '🎙️' : '🎉'}</Text>
      <Text style={[s.title, { fontSize: 28 }]}>¡Alarma desactivada!</Text>
      <Text style={[s.muted, { marginBottom: 48, textAlign: 'center' }]}>
        {byVoice ? 'Lo hiciste con la voz. ¡Qué crack! 🗣️' : 'Buen trabajo. Ya estás despierto/a.'}
      </Text>
      {!byVoice && (
        <>
          <Text style={{ fontSize: 56, fontWeight: '500', color: COLORS.accent }}>{elapsed}</Text>
          <Text style={s.muted}>segundos</Text>
        </>
      )}
      <TouchableOpacity style={[s.btnPrimary, { marginTop: 48 }]} onPress={onReset} activeOpacity={0.8}>
        <Text style={s.btnText}>Volver al inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── APP PRINCIPAL ─────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('alarm');
  const startTimeRef = useRef(null);
  const [elapsed, setElapsed]   = useState(0);
  const [method,  setMethod]    = useState('game'); // 'game' | 'voice'

  const startGame = (game) => {
    startTimeRef.current = Date.now();
    setScreen(game);
  };

  const handleWin = () => {
    setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    setMethod('game');
    setScreen('success');
  };

  const handleVoiceWin = () => {
    setMethod('voice');
    setScreen('success');
  };

  if (screen === 'alarm')    return <AlarmScreen onDisarm={() => setScreen('selector')} onVoiceDisarm={handleVoiceWin} />;
  if (screen === 'selector') return <GameSelector onSelect={startGame} />;
  if (screen === 'math')     return <MathGame   onWin={handleWin} onBack={() => setScreen('selector')} />;
  if (screen === 'memory')   return <MemoryGame  onWin={handleWin} onBack={() => setScreen('selector')} />;
  if (screen === 'typing')   return <TypingGame  onWin={handleWin} onBack={() => setScreen('selector')} />;
  if (screen === 'success')  return <SuccessScreen elapsed={elapsed} method={method} onReset={() => setScreen('alarm')} />;
}

// ─── ESTILOS ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:        { flex: 1, padding: 24 },
  text:          { color: COLORS.text, fontSize: 16 },
  muted:         { color: COLORS.muted, fontSize: 14 },
  title:         { color: COLORS.text, fontSize: 22, fontWeight: '500', marginBottom: 4 },
  topBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  backBtn:       { color: COLORS.muted, fontSize: 15 },

  // ALARMA
  alarmTime:     { fontSize: 80, fontWeight: '300', color: COLORS.text, letterSpacing: -2 },
  alarmRing:     { width: 130, height: 130, borderRadius: 65, borderWidth: 2, borderColor: 'rgba(233,69,96,0.5)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(233,69,96,0.1)' },
  divider:       { flexDirection: 'row', alignItems: 'center', width: '80%', marginTop: 24, marginBottom: 4 },
  divLine:       { flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  divText:       { color: COLORS.muted, marginHorizontal: 12, fontSize: 13 },

  // BTN
  btnPrimary:    { backgroundColor: COLORS.accent, borderRadius: 50, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnText:       { color: '#fff', fontSize: 18, fontWeight: '500' },

  // SELECTOR
  gameCard:      { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.card, marginBottom: 12 },
  gameName:      { color: COLORS.text, fontSize: 16, fontWeight: '500' },
  diffBadge:     { borderWidth: 0.5, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },

  // MATH
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, marginBottom: 8 },
  progressFill:  { height: 4, backgroundColor: COLORS.accent, borderRadius: 2 },
  mathQ:         { fontSize: 52, fontWeight: '500', color: COLORS.text, marginBottom: 36 },
  optsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  optBtn:        { width: (width - 72) / 2, paddingVertical: 18, borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center' },

  // MEMORY
  memGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memCard:       { width: CARD_SIZE, height: CARD_SIZE, borderRadius: 8, borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  memMatched:    { backgroundColor: 'rgba(29,158,117,0.2)', borderColor: COLORS.success },

  // TYPING
  phraseBox:     { padding: 16, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border, marginBottom: 24, flexDirection: 'row', flexWrap: 'wrap' },
  typingInput:   { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 12, padding: 14, color: COLORS.text, fontSize: 18, backgroundColor: COLORS.card, fontFamily: 'monospace' },
});
