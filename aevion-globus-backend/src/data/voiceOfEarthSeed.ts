// Voice of Earth — initial seed of multi-language positive songs.
// Lyrics are short placeholder originals (not copyrighted) for MVP demo.

export type VoeSeedTrack = {
  title: string;
  artistAlias: string;
  language: string;
  mood: "hopeful" | "peaceful" | "joyful" | "reflective" | "uplifting";
  lyrics: string;
  audioUrl: string | null;
};

export const VOICE_OF_EARTH_SEED: VoeSeedTrack[] = [
  {
    title: "Утро над миром",
    artistAlias: "Лучик",
    language: "ru",
    mood: "hopeful",
    lyrics:
      "Просыпается солнце, тает туман,\n" +
      "Я иду по дороге, и небо со мной.\n" +
      "Каждый шаг — это новый рассвет,\n" +
      "Каждый вздох — это маленький свет.\n\n" +
      "Припев:\n" +
      "Мы построим мост из улыбок,\n" +
      "Мы услышим друг друга сквозь шум.\n" +
      "Утро над миром, оно для всех —\n" +
      "Один большой, один тёплый смех.",
    audioUrl: null,
  },
  {
    title: "Тихая река",
    artistAlias: "Вечер у окна",
    language: "ru",
    mood: "peaceful",
    lyrics:
      "Тихая река течёт сквозь поля,\n" +
      "Не спешит, не зовёт, просто дышит земля.\n" +
      "Сядь на берег, послушай ветра рассказ,\n" +
      "Время мягко идёт, обнимая нас.\n\n" +
      "Припев:\n" +
      "Всё на месте, всё пройдёт, всё вернётся опять,\n" +
      "Тихая река учит нас не молчать, но и не кричать.\n" +
      "Здесь, у воды, мы целы и просты,\n" +
      "Здесь, у воды, ты — это ты.",
    audioUrl: null,
  },
  {
    title: "Танцуй со мной",
    artistAlias: "Карамель",
    language: "ru",
    mood: "joyful",
    lyrics:
      "Эй, отпусти все заботы, пусть ноги летят,\n" +
      "Эй, посмотри как смеются глаза у ребят!\n" +
      "Музыка громче, а небо — синее всего,\n" +
      "Сегодня мы вместе и нам не страшно ничего.\n\n" +
      "Припев:\n" +
      "Танцуй со мной, танцуй со мной,\n" +
      "Под этим солнцем мы одной семьёй.\n" +
      "Танцуй со мной, забудь покой,\n" +
      "Сегодня мир улыбается с тобой!",
    audioUrl: null,
  },
  {
    title: "Light Across the Border",
    artistAlias: "Northern Echo",
    language: "en",
    mood: "hopeful",
    lyrics:
      "There's a light across the border, a hand across the sea,\n" +
      "A whisper in the morning, saying you are not alone, not alone with me.\n" +
      "Every language is a window, every silence is a song,\n" +
      "We were never really strangers, just been waiting all along.\n\n" +
      "Chorus:\n" +
      "Carry your light, carry it far,\n" +
      "Wherever you are, you are who you are.\n" +
      "Carry your light, hand it to me,\n" +
      "Together we are bigger than the sea.",
    audioUrl: null,
  },
  {
    title: "Higher Ground",
    artistAlias: "Mara Lane",
    language: "en",
    mood: "uplifting",
    lyrics:
      "Pull me up, lift me up, take me to the higher ground,\n" +
      "Where the rivers learn to sing without a sound.\n" +
      "I have stumbled, I have fallen, I have laughed and cried out loud,\n" +
      "But the morning still keeps coming, breaking gently through the cloud.\n\n" +
      "Chorus:\n" +
      "Higher ground, higher ground,\n" +
      "Where the lost are always found.\n" +
      "Higher ground, higher ground,\n" +
      "Lift each other, gather round.",
    audioUrl: null,
  },
  {
    title: "Quiet Letters",
    artistAlias: "Sam Holloway",
    language: "en",
    mood: "reflective",
    lyrics:
      "I wrote a quiet letter to the person I once was,\n" +
      "Told her she was braver than she ever knew, because.\n" +
      "Every scar a doorway, every doubt a small bright key,\n" +
      "Every road she walked alone was bringing her to me.\n\n" +
      "Chorus:\n" +
      "Be kind to who you used to be,\n" +
      "She carried you across the sea.\n" +
      "Be kind, be kind, be kind, be kind —\n" +
      "Leave a softer trail behind.",
    audioUrl: null,
  },
  {
    title: "Дала тыныштығы",
    artistAlias: "Айдын",
    language: "kk",
    mood: "peaceful",
    lyrics:
      "Кең дала тыныш, ай астында үндемейді,\n" +
      "Жүрегімде жаңбыр, бірақ зиянын тигізбейді.\n" +
      "Ата-бабамның үні желмен қосыла,\n" +
      "Менің атымды атап, жолымды нұрға толтыра.\n\n" +
      "Қайырмасы:\n" +
      "Тыныштық, тыныштық, дала үстінде,\n" +
      "Жүрегімде өлең, көзімде кеш.\n" +
      "Тыныштық, тыныштық, бәріне жетеді —\n" +
      "Бір тілмен сөйлемесек те, бір жүрекпен өмір өтеді.",
    audioUrl: null,
  },
  {
    title: "Sol de los días buenos",
    artistAlias: "Lucía Marín",
    language: "es",
    mood: "joyful",
    lyrics:
      "Sale el sol de los días buenos, baila en mi ventana,\n" +
      "Llama a mis vecinos, llama a toda la mañana.\n" +
      "El café huele a abuela, la radio canta en francés,\n" +
      "Hoy el mundo es pequeño y cabe entre tú y yo, otra vez.\n\n" +
      "Coro:\n" +
      "Que viva, que viva, que viva el sol,\n" +
      "Que viva la risa, que viva tu voz.\n" +
      "Que viva, que viva, todo lo que ves —\n" +
      "Hoy la vida nos regala otro mes.",
    audioUrl: null,
  },
];
