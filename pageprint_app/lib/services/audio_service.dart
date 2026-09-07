import 'package:flutter/services.dart';
import 'package:audioplayers/audioplayers.dart';

class AudioService {
  static final AudioService instance = AudioService._internal();
  AudioService._internal();

  final AudioPlayer _player = AudioPlayer();
  bool isMuted = false;

  /// Play high-clarity soundbox alert when a new print order is received
  Future<void> playNewOrderChime() async {
    if (isMuted) return;

    try {
      // 1. Play native system sound (works instantly offline on all platforms)
      await SystemSound.play(SystemSoundType.alert);

      // 2. Play secondary bell tone for double chime feel
      await Future.delayed(const Duration(milliseconds: 150));
      await SystemSound.play(SystemSoundType.alert);
    } catch (_) {
      // Fallback: silent fail or audio player
    }
  }

  void toggleMute() {
    isMuted = !isMuted;
  }

  void dispose() {
    _player.dispose();
  }
}
