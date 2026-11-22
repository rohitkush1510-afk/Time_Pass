/* MoodMapping — emotion-to-mood mapping.
   face-api's FaceExpressionNet outputs 7 basic expressions:
     happy, sad, angry, fearful, disgusted, surprised, neutral
   These are merged into the app's 6 moods for anime recommendations. */
window.MoodMapping = {
    MOOD_CONFIG: {
        happy:     { emoji: '\u{1F60A}', label: 'Happy',     color: '#f5c542', genres: 'Comedy,Slice of Life',    genreNames: 'Comedy, Slice of Life' },
        sad:       { emoji: '\u{1F622}', label: 'Sad',       color: '#6ca8e8', genres: 'Drama,Romance',           genreNames: 'Drama, Romance' },
        angry:     { emoji: '\u{1F620}', label: 'Angry',     color: '#e05545', genres: 'Action,Fantasy',          genreNames: 'Action, Fantasy' },
        surprised: { emoji: '\u{1F632}', label: 'Surprised', color: '#f08c3a', genres: 'Mystery,Thriller',        genreNames: 'Mystery, Thriller' },
        neutral:   { emoji: '\u{1F610}', label: 'Neutral',   color: '#9a937f', genres: 'Slice of Life,Adventure', genreNames: 'Slice of Life, Adventure' },
        naughty:   { emoji: '\u{1F60F}', label: 'Naughty',   color: '#d15a7c', genres: 'Ecchi,Romance',           genreNames: 'Ecchi, Romance' }
    },

    CURATED_ANIME: {
        happy: ['K-On!', 'Spy x Family', 'Nichijou'],
        sad: ['Clannad: After Story', "Shigatsu wa Kimi no Uso", 'Violet Evergarden'],
        angry: ['Kill la Kill', 'Attack on Titan', 'Demon Slayer'],
        surprised: ['Death Note', 'Steins;Gate', 'Promised Neverland'],
        neutral: ['Barakamon', 'Flying Witch', 'Non Non Biyori'],
        naughty: ['High School DxD', 'Prison School', 'Food Wars']
    },

    mapEmotionToMood(emotion) {
        if (!emotion) return 'neutral';
        // "fearful" and "disgusted" are unreliable to surface on their own,
        // so they fold into "surprised" and "naughty" respectively.
        switch (emotion) {
            case 'happy':   return 'happy';
            case 'sad':     return 'sad';
            case 'angry':   return 'angry';
            case 'surprised': return 'surprised';
            case 'fearful': return 'surprised';
            case 'disgusted': return 'naughty';
            case 'neutral': return 'neutral';
            default:        return 'neutral';
        }
    },

    resolveWinningMood(scores) {
        if (!scores) return { mood: 'neutral', confidence: 0, moodScores: {} };

        const moodScores = {};
        for (const [emotion, val] of Object.entries(scores)) {
            const mood = this.mapEmotionToMood(emotion);
            moodScores[mood] = (moodScores[mood] || 0) + val;
        }

        let sum = 0;
        for (const v of Object.values(moodScores)) sum += v;
        if (sum > 0) for (const k in moodScores) moodScores[k] /= sum;

        const sorted = Object.entries(moodScores).sort((a, b) => b[1] - a[1]);
        return {
            mood: sorted[0][0],
            confidence: sorted[0][1],
            moodScores
        };
    },

    getGenresForMood(mood) {
        return this.MOOD_CONFIG[mood] ? this.MOOD_CONFIG[mood].genres : '';
    },

    getMoodEmoji(mood) {
        return this.MOOD_CONFIG[mood] ? this.MOOD_CONFIG[mood].emoji : '\u{1F610}';
    },

    getAllMoods() {
        return Object.keys(this.MOOD_CONFIG);
    }
};
