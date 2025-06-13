// Priority 3: Adhan Beep
      console.log(`MurottalPlayer: Checking Adhan Beep. URL: ${!!settings.adhan_beep_audio_url}`);
      if (settings.adhan_beep_audio_url) {
        const adhanPrayers = [
          { name: "Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Dzuhur", adhanTime: dayjs(prayerTimes.dhuhr) },
          { name: "Ashar", adhanTime: dayjs(prayerTimes.asr) },
          { name: "Maghrib", adhanTime: dayjs(prayerTimes.maghrib) },
          { name: "Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const adhanConfig of adhanPrayers) {
          const adhanTime = adhanConfig.adhanTime;
          const adhanBeepEventName = `${adhanConfig.name} Adhan Beep`;
          console.log(`MurottalPlayer: Adhan Beep ${adhanConfig.name} Time: ${adhanTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          // Play beep exactly at adhan time (within a 1-second window)
          if (now.isBetween(adhanTime.subtract(1, 'second'), adhanTime.add(1, 'second'), null, '[]') && !playedTodayRef.current.has(adhanBeepEventName)) {
            console.log(`MurottalPlayer: Condition met for Adhan Beep ${adhanConfig.name}. Attempting to play.`);
            if (await playAudio(settings.adhan_beep_audio_url, adhanBeepEventName)) {
              return;
            }
          }
        }
      }

      // Priority 4: Iqomah Beep
      console.log(`MurottalPlayer: Checking Iqomah Beep. URL: ${!!settings.iqomah_beep_audio_url}`);
      if (settings.iqomah_beep_audio_url) {
        const iqomahPrayers = [
          { name: "Subuh", adhanTime: dayjs(prayerTimes.fajr), iqomahDuration: settings.iqomah_countdown_duration },
          { name: "Dzuhur", adhanTime: dayjs(prayerTimes.dhuhr), iqomahDuration: settings.iqomah_countdown_duration },
          { name: "Ashar", adhanTime: dayjs(prayerTimes.asr), iqomahDuration: settings.iqomah_countdown_duration },
          { name: "Maghrib", adhanTime: dayjs(prayerTimes.maghrib), iqomahDuration: settings.maghrib_iqomah_countdown_duration },
          { name: "Isya", adhanTime: dayjs(prayerTimes.isha), iqomahDuration: settings.iqomah_countdown_duration },
        ];

        for (const iqomahConfig of iqomahPrayers) {
          const adhanEndTime = iqomahConfig.adhanTime.add(settings.adhan_duration_seconds, 'second');
          const iqomahTime = adhanEndTime; // Iqomah starts right after Adhan ends
          const iqomahBeepEventName = `${iqomahConfig.name} Iqomah Beep`;
          console.log(`MurottalPlayer: Iqomah Beep ${iqomahConfig.name} Time: ${iqomahTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          if (now.isBetween(iqomahTime.subtract(1, 'second'), iqomahTime.add(1, 'second'), null, '[]') && !playedTodayRef.current.has(iqomahBeepEventName)) {
            console.log(`MurottalPlayer: Condition met for Iqomah Beep ${iqomahConfig.name}. Attempting to play.`);
            if (await playAudio(settings.iqomah_beep_audio_url, iqomahBeepEventName)) {
              return;
            }
          }
        }
      }

      // Priority 5: Murottal per waktu sholat
      console.log("MurottalPlayer: Checking Murottal per prayer time.");
      for (const config of PRAYER_CONFIGS) {
        const isActive = settings[config.activeField];
        const audioUrl = settings[config.audioUrlField];
        const preAdhanDurationMinutes = settings[config.durationField] || 0;
        const prayerTime = dayjs(prayerTimes.timeForPrayer(Adhan.Prayer[config.adhanName.charAt(0).toUpperCase() + config.adhanName.slice(1) as keyof typeof Adhan.Prayer]));
        
        const murottalStartTime = prayerTime.subtract(preAdhanDurationMinutes, 'minute');
        const murottalEndTime = prayerTime; // Murottal stops at Adhan time
        const eventName = `${config.name} Murottal`;

        console.log(`MurottalPlayer: Murottal ${config.name} - Active: ${isActive}, URL: ${!!audioUrl}, Start: ${murottalStartTime.format('HH:mm:ss')}, End: ${murottalEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}, Played Today: ${playedTodayRef.current.has(eventName)}`);

        if (isActive && audioUrl && now.isBetween(murottalStartTime, murottalEndTime, null, '[)') && !playedTodayRef.current.has(eventName)) {
          console.log(`MurottalPlayer: Condition met for Murottal ${config.name}. Attempting to play.`);
          if (await playAudio(audioUrl, eventName, true, config.name)) {
            return;
          }
        }
      }

      // Priority 6: Imsak Murottal (if Ramadan mode active)
      console.log(`MurottalPlayer: Checking Imsak Murottal. Ramadan Active: ${settings.is_ramadan_mode_active}, Active: ${settings[IMSAK_CONFIG.activeField]}, URL: ${!!settings[IMSAK_CONFIG.audioUrlField]}`);
      if (settings.is_ramadan_mode_active && settings[IMSAK_CONFIG.activeField] && settings[IMSAK_CONFIG.audioUrlField]) {
        const imsakTime = dayjs(prayerTimes.fajr).subtract(10, 'minute').add(settings.imsak_offset ?? 0, 'minute');
        const preAdhanDurationMinutes = settings[IMSAK_CONFIG.durationField] || 0;
        const murottalStartTime = imsakTime.subtract(preAdhanDurationMinutes, 'minute');
        const murottalEndTime = imsakTime; // Imsak murottal stops at Imsak time
        const eventName = `${IMSAK_CONFIG.name} Murottal`;

        console.log(`MurottalPlayer: Murottal Imsak - Start: ${murottalStartTime.format('HH:mm:ss')}, End: ${murottalEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}, Played Today: ${playedTodayRef.current.has(eventName)}`);

        if (now.isBetween(murottalStartTime, murottalEndTime, null, '[)') && !playedTodayRef.current.has(eventName)) {
          console.log(`MurottalPlayer: Condition met for Murottal Imsak. Attempting to play.`);
          if (await playAudio(settings[IMSAK_CONFIG.audioUrlField], eventName, true, IMSAK_CONFIG.name)) {
            return;
          }
        }
      }

      // If no audio is supposed to be playing, ensure it's paused
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        console.log("MurottalPlayer: No audio condition met. Pausing current audio.");
      }
    };

    const interval = setInterval(checkAndPlayAudioLoop, 1000);
    checkAndPlayAudioLoop(); // Initial check

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnded);
        audioRef.current.removeEventListener('pause', handleAudioPause);
        audioRef.current.removeEventListener('play', handleAudioPlay);
      }
      clearInterval(interval);
      console.log("MurottalPlayer: Cleanup. Interval cleared, event listeners removed.");
    };
  }, [settings, prayerTimes, onPlayingChange, playAudio, savePlaybackPosition, pausedMurottalInfo, playbackPositions]);

  return (
    <audio ref={audioRef} className="hidden" />
  );
};

export default MurottalPlayer;