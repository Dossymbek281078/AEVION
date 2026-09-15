# -*- coding: utf-8 -*-
"""Спектральное сравнение нашего мастера с эталоном (сумма стемов оригинала).
Третьоктавные полосы, средний уровень, нормировка по общей громкости.
python spectral-compare.py <наш.wav> <эталон1.wav> [эталон2.wav ...]"""
import sys, numpy as np, soundfile as sf
from scipy import signal
def load(p, sr=44100):
    y,s = sf.read(p)
    if y.ndim>1: y=y.mean(axis=1)
    if s!=sr: y=signal.resample_poly(y,sr,s)
    return y
def bands(y, sr=44100):
    # третьоктавные центры 40..16000
    f=[40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000]
    F,_,Z = signal.stft(y, sr, nperseg=8192)
    P = (np.abs(Z)**2).mean(axis=1)
    out=[]
    for c in f:
        lo,hi=c/2**(1/6), c*2**(1/6)
        m=(F>=lo)&(F<hi)
        out.append(10*np.log10(P[m].sum()+1e-12) if m.any() else -120)
    return np.array(f), np.array(out)
def сравнить(пути):
    ours = load(пути[0])
    ref=None
    for p in пути[1:]:
        y=load(p); ref = y if ref is None else ref[:min(len(ref),len(y))]+y[:min(len(ref),len(y))]
    f,a=bands(ours); _,b=bands(ref)
    a-=a.max(); b-=b.max()          # нормировка по пику спектра
    d=a-b
    print("полоса | наш | эталон | разница")
    groups=[("низ 40-100",(f>=40)&(f<=100)),("бас 125-250",(f>=125)&(f<=250)),
            ("низ.сер 315-800",(f>=315)&(f<=800)),("сер 1000-2500",(f>=1000)&(f<=2500)),
            ("верх.сер 3150-6300",(f>=3150)&(f<=6300)),("верх 8000-16000",(f>=8000)&(f<=16000))]
    for name,m in groups:
        print("%-20s %+6.1f дБ (наш %+.1f, эталон %+.1f)"%(name, d[m].mean(), a[m].mean(), b[m].mean()))
    print("\nвердикт: |разница| > 4 дБ = стоит поправить эквализацией")
    worst=[(name, float(d[m].mean())) for name,m in groups if abs(d[m].mean())>4]
    print("проблемные полосы:", worst if worst else "нет")
    return 1 if worst else 0


def самопроверка():
    """Прибор на сигналах, ответ для которых известен заранее.

    Зачем: на числах этого прибора построен весь вывод о провале середины
    (0.8 % против 9 % у эталона) — а сам он до 13.09.2026 не проверялся ничем.
    """
    import tempfile, os
    sr = 44100
    t = np.arange(int(sr * 4.0)) / sr
    rng = np.random.default_rng(7)
    шум = rng.normal(0, 0.1, len(t))
    сделано, всего = 0, 4

    def файл(y):
        f = tempfile.mktemp(suffix=".wav")
        sf.write(f, y, sr)
        return f

    def полосы(y):
        return bands(y)[1]

    a = полосы(шум)
    if float(np.abs(a - полосы(шум)).max()) < 1e-9:
        сделано += 1
    else:
        print("ПРОВАЛ 1: один и тот же сигнал даёт разные полосы")

    # вырезанная середина обязана просесть ИМЕННО в середине
    sos = signal.butter(4, [400, 2000], btype="bandstop", fs=sr, output="sos")
    без_середины = signal.sosfilt(sos, шум)
    f, b = bands(без_середины)
    _, c = bands(шум)
    b = b - b.max(); c = c - c.max()
    m_сер = (f >= 500) & (f <= 1600)
    m_низ = (f >= 40) & (f <= 100)
    if (b - c)[m_сер].mean() < -6 and abs((b - c)[m_низ].mean()) < 3:
        сделано += 1
    else:
        print("ПРОВАЛ 2: вырез середины дал %.1f дБ в середине и %.1f дБ в низу"
              % ((b - c)[m_сер].mean(), (b - c)[m_низ].mean()))

    # ОТРИЦАТЕЛЬНЫЙ: одинаковые сигналы — проблемных полос быть не должно
    ф1, ф2 = файл(шум), файл(шум)
    try:
        код = сравнить([ф1, ф2])
        if код == 0:
            сделано += 1
        else:
            print("ПРОВАЛ 3: одинаковые сигналы объявлены различающимися")
    finally:
        os.unlink(ф1); os.unlink(ф2)

    # и наоборот: заметно разные обязаны дать находку
    ф3, ф4 = файл(шум), файл(без_середины)
    try:
        if сравнить([ф3, ф4]) == 1:
            сделано += 1
        else:
            print("ПРОВАЛ 4: вырезанная середина не признана проблемной полосой")
    finally:
        os.unlink(ф3); os.unlink(ф4)

    print("самопроверка spectral-compare: %d из %d" % (сделано, всего))
    return 0 if сделано == всего else 2


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(самопроверка())
    пути = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(пути) < 2:
        print("нужны наш файл и хотя бы один эталон (это НЕ «совпадает»)")
        sys.exit(2)
    sys.exit(сравнить(пути))
