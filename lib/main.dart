// main.dart — Super Gate: Entry point + App root
//
// Kiến trúc:
//   main()           → init Supabase → tryRestoreSession → runApp
//   SuperGateApp     → MaterialApp dark theme
//   _AppGate         → Auth check → WelcomeScreen / HomeScreen

import 'package:flutter/material.dart';
import 'auth/auth_service.dart';
import 'auth/auth_screen.dart';
import 'coin/coin_service.dart';
import 'coin/weekly_mission_service.dart';
import 'coin/achievement_service.dart';
import 'onboarding/onboarding_service.dart';
import 'onboarding/welcome_screen.dart';
import 'home/home_screen.dart';

// =============================================================================
// ENTRY POINT
// =============================================================================

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Init Supabase (bắt buộc trước mọi thứ)
  await AuthService.initSupabase();

  // 2. Thử restore session đã có (không force login)
  final player = await AuthService.instance.tryRestoreSession();

  if (player != null) {
    // Session hợp lệ → init services luôn
    await OnboardingService.instance.init();
    await CoinService.instance.init(isNewPlayer: player.isNewPlayer);
    await WeeklyMissionService.instance.init();
    await AchievementService.instance.init();
  }

  runApp(const SuperGateApp());
}

// =============================================================================
// ROOT APP
// =============================================================================

class SuperGateApp extends StatelessWidget {
  const SuperGateApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Super Gate',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0A0A1A),
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF7C6FFF),
          brightness: Brightness.dark,
          surface: const Color(0xFF0A0A1A),
        ),
      ),
      home: const _AppGate(),
    );
  }
}

// =============================================================================
// APP GATE — Auth check → route Login / Welcome / Home
// =============================================================================

class _AppGate extends StatefulWidget {
  const _AppGate();

  @override
  State<_AppGate> createState() => _AppGateState();
}

class _AppGateState extends State<_AppGate> {
  bool _authenticated = false;
  bool _showWelcome   = false;

  @override
  void initState() {
    super.initState();
    _authenticated = AuthService.instance.isAuthenticated;
    if (_authenticated) {
      _showWelcome = OnboardingService.instance.shouldShowWelcome;
    }
    AuthService.instance.authNotifier.addListener(_onAuthChanged);
  }

  @override
  void dispose() {
    AuthService.instance.authNotifier.removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    if (!AuthService.instance.isAuthenticated && mounted) {
      setState(() {
        _authenticated = false;
        _showWelcome   = false;
      });
    }
  }

  /// Gọi sau khi login/register thành công (AuthScreen sẽ đã init services)
  Future<void> _onAuthenticated() async {
    final isNew = OnboardingService.instance.shouldShowWelcome;
    if (mounted) {
      setState(() {
        _authenticated = true;
        _showWelcome   = isNew;
      });
    }
  }

  void _onOnboardingComplete() {
    if (mounted) setState(() => _showWelcome = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_authenticated) {
      return AuthScreen(onAuthenticated: _onAuthenticated);
    }
    if (_showWelcome) {
      return WelcomeScreen(onComplete: _onOnboardingComplete);
    }
    return const HomeScreen();
  }
}
