// onboarding_service.dart — Quản lý trạng thái onboarding người chơi mới

import 'package:shared_preferences/shared_preferences.dart';

class OnboardingService {
  OnboardingService._();
  static final OnboardingService instance = OnboardingService._();

  static const _kOnboardingDone    = 'onboarding_done';
  static const _kOnboardingPage    = 'onboarding_page';  // bước đang dở
  static const _kInitialCoinsGiven = 'initial_coins_given';

  bool _onboardingDone = false;
  bool _initialCoinsGiven = false;
  int _lastPage = 0;

  bool get isOnboardingDone    => _onboardingDone;
  bool get initialCoinsGiven   => _initialCoinsGiven;
  int  get lastPage            => _lastPage;
  bool get shouldShowWelcome   => !_onboardingDone;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _onboardingDone    = prefs.getBool(_kOnboardingDone) ?? false;
    _initialCoinsGiven = prefs.getBool(_kInitialCoinsGiven) ?? false;
    _lastPage          = prefs.getInt(_kOnboardingPage) ?? 0;
  }

  Future<void> completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    _onboardingDone = true;
    await prefs.setBool(_kOnboardingDone, true);
    await prefs.remove(_kOnboardingPage);
  }

  Future<void> markInitialCoinsGiven() async {
    final prefs = await SharedPreferences.getInstance();
    _initialCoinsGiven = true;
    await prefs.setBool(_kInitialCoinsGiven, true);
  }

  Future<void> savePage(int page) async {
    final prefs = await SharedPreferences.getInstance();
    _lastPage = page;
    await prefs.setInt(_kOnboardingPage, page);
  }

  Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    _onboardingDone = false;
    _initialCoinsGiven = false;
    _lastPage = 0;
    await prefs.remove(_kOnboardingDone);
    await prefs.remove(_kOnboardingPage);
    await prefs.remove(_kInitialCoinsGiven);
  }
}
