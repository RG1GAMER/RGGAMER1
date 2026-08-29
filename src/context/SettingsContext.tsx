import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";

export const SettingsContext = createContext<any>(null);

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [panelName, setPanelName] = useState<string>(() => localStorage.getItem("jtg_panel_name") || "JTG Panel");
  const [panelLogo, setPanelLogo] = useState<string>(() => localStorage.getItem("jtg_panel_logo") || "");
  const [panelBackgroundImage, setPanelBackgroundImage] = useState<string>(() => localStorage.getItem("jtg_panel_bg") || "");
  const [panelBackgroundBlur, setPanelBackgroundBlur] = useState<number>(() => {
    const v = localStorage.getItem("jtg_panel_blur");
    return v ? parseInt(v, 10) : 10;
  });
  const [enablePlayit, setEnablePlayit] = useState<boolean>(false);
  const [enableTutorial, setEnableTutorial] = useState<boolean>(true);
  const [enableLoginAnimation, setEnableLoginAnimation] = useState<boolean>(true);
  const [enableRegistration, setEnableRegistration] = useState<boolean>(true);
  const [theme, setThemeState] = useState<string>(() => localStorage.getItem("jtg_theme") || "red");
  const [buttonColor, setButtonColorState] = useState<string>(() => localStorage.getItem("jtg_button_color") || "theme");
  const [uiTheme, setUiThemeState] = useState<string>(() => localStorage.getItem("jtg_ui_theme") || "dark");
  const [enableGoogleLogin, setEnableGoogleLogin] = useState<boolean>(false);
  const [firebaseApiKey, setFirebaseApiKey] = useState<string>("");
  const [firebaseAuthDomain, setFirebaseAuthDomain] = useState<string>("");
  const [firebaseProjectId, setFirebaseProjectId] = useState<string>("");
  const [firebaseStorageBucket, setFirebaseStorageBucket] = useState<string>("");
  const [firebaseMessagingSenderId, setFirebaseMessagingSenderId] = useState<string>("");
  const [firebaseAppId, setFirebaseAppId] = useState<string>("");
  const [defaultRuntime, setDefaultRuntime] = useState<string>("docker");
  const [runtimeLocked, setRuntimeLocked] = useState<boolean>(false);
  const [environment, setEnvironment] = useState<any>(null);
  const [isDev, setIsDev] = useState<boolean>(false);
  const [playitServiceMode, setPlayitServiceMode] = useState<string>("managed_process");
  const [playitServiceName, setPlayitServiceName] = useState<string>("playit");
  const [healthCheckIntervalMinutes, setHealthCheckIntervalMinutes] = useState<number>(5);
  const [restartDelaySeconds, setRestartDelaySeconds] = useState<number>(20);
  const [maxRecoveryAttempts, setMaxRecoveryAttempts] = useState<number>(3);
  const [allowRecoveryWhilePlayersOnline, setAllowRecoveryWhilePlayersOnline] = useState<boolean>(false);

  const setTheme = useCallback((val: string, syncToServer = false) => {
    const finalVal = val || "red";
    setThemeState(finalVal);
    try {
      localStorage.setItem("jtg_theme", finalVal);
      document.documentElement.setAttribute("data-theme", finalVal);
      if (syncToServer) {
        axios.put("/api/system/settings", { theme: finalVal }).catch(() => {});
      }
    } catch {}
  }, []);

  const setButtonColor = useCallback((val: string, syncToServer = false) => {
    const finalVal = val || "theme";
    setButtonColorState(finalVal);
    try {
      localStorage.setItem("jtg_button_color", finalVal);
      document.documentElement.setAttribute("data-button-color", finalVal);
      if (syncToServer) {
        axios.put("/api/system/settings", { buttonColor: finalVal }).catch(() => {});
      }
    } catch {}
  }, []);

  const setUiTheme = useCallback((val: string, syncToServer = false) => {
    const finalVal = val || "dark";
    setUiThemeState(finalVal);
    try {
      localStorage.setItem("jtg_ui_theme", finalVal);
      document.documentElement.setAttribute("data-ui-theme", finalVal);
      if (syncToServer) {
        axios.put("/api/system/settings", { uiTheme: finalVal }).catch(() => {});
      }
    } catch {}
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get("/api/settings");
      if (res.data) {
        if (res.data.panelName) {
          setPanelName(res.data.panelName);
          localStorage.setItem("jtg_panel_name", res.data.panelName);
        }
        if (res.data.panelLogo !== undefined) {
          setPanelLogo(res.data.panelLogo);
          localStorage.setItem("jtg_panel_logo", res.data.panelLogo || "");
        }
        if (res.data.panelBackgroundImage !== undefined) {
          setPanelBackgroundImage(res.data.panelBackgroundImage);
          localStorage.setItem("jtg_panel_bg", res.data.panelBackgroundImage || "");
        }
        if (res.data.panelBackgroundBlur !== undefined) {
          setPanelBackgroundBlur(res.data.panelBackgroundBlur);
          localStorage.setItem("jtg_panel_blur", String(res.data.panelBackgroundBlur));
        }
        if (res.data.enablePlayit !== undefined) setEnablePlayit(res.data.enablePlayit);
        if (res.data.enableTutorial !== undefined) setEnableTutorial(res.data.enableTutorial);
        if (res.data.enableLoginAnimation !== undefined) setEnableLoginAnimation(res.data.enableLoginAnimation);
        if (res.data.enableRegistration !== undefined) setEnableRegistration(res.data.enableRegistration);
        if (res.data.enableGoogleLogin !== undefined) setEnableGoogleLogin(res.data.enableGoogleLogin);
        if (res.data.firebaseApiKey !== undefined) setFirebaseApiKey(res.data.firebaseApiKey);
        if (res.data.firebaseAuthDomain !== undefined) setFirebaseAuthDomain(res.data.firebaseAuthDomain);
        if (res.data.firebaseProjectId !== undefined) setFirebaseProjectId(res.data.firebaseProjectId);
        if (res.data.firebaseStorageBucket !== undefined) setFirebaseStorageBucket(res.data.firebaseStorageBucket);
        if (res.data.firebaseMessagingSenderId !== undefined) setFirebaseMessagingSenderId(res.data.firebaseMessagingSenderId);
        if (res.data.firebaseAppId !== undefined) setFirebaseAppId(res.data.firebaseAppId);
        if (res.data.defaultRuntime !== undefined) setDefaultRuntime(res.data.defaultRuntime);
        if (res.data.runtimeLocked !== undefined) setRuntimeLocked(res.data.runtimeLocked);
        if (res.data.environment !== undefined) setEnvironment(res.data.environment);
        if (res.data.isDev !== undefined) setIsDev(res.data.isDev);
        if (res.data.playitServiceMode !== undefined) setPlayitServiceMode(res.data.playitServiceMode);
        if (res.data.playitServiceName !== undefined) setPlayitServiceName(res.data.playitServiceName);
        if (res.data.healthCheckIntervalMinutes !== undefined) setHealthCheckIntervalMinutes(res.data.healthCheckIntervalMinutes);
        if (res.data.restartDelaySeconds !== undefined) setRestartDelaySeconds(res.data.restartDelaySeconds);
        if (res.data.maxRecoveryAttempts !== undefined) setMaxRecoveryAttempts(res.data.maxRecoveryAttempts);
        if (res.data.allowRecoveryWhilePlayersOnline !== undefined) setAllowRecoveryWhilePlayersOnline(res.data.allowRecoveryWhilePlayersOnline);
        
        if (res.data.theme) {
          setTheme(res.data.theme);
        }
        if (res.data.buttonColor) {
          setButtonColor(res.data.buttonColor);
        }
        if (res.data.uiTheme) {
          setUiTheme(res.data.uiTheme);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    // Synchronously apply initial theme attributes immediately
    document.documentElement.setAttribute("data-theme", theme || "red");
    document.documentElement.setAttribute("data-button-color", buttonColor || "theme");
    document.documentElement.setAttribute("data-ui-theme", uiTheme || "dark");

    fetchSettings();
    const token = localStorage.getItem("jtg_token") || localStorage.getItem("token");
    if (!token) return;
    const socket = io({ auth: { token } });
    socket.on("settings_updated", () => {
      fetchSettings();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (panelName) {
      document.title = panelName;
    }
  }, [panelName]);
  
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme || "red");
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-button-color", buttonColor || "theme");
  }, [buttonColor]);

  useEffect(() => {
    document.documentElement.setAttribute("data-ui-theme", uiTheme || "dark");
  }, [uiTheme]);

  useEffect(() => {
    if (panelLogo) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = panelLogo;
    } else {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = "/vite.svg"; // Fallback or clear
      }
    }
  }, [panelLogo]);

  return (
    <SettingsContext.Provider value={{ 
      panelName, setPanelName, 
      panelLogo, setPanelLogo, 
      panelBackgroundImage, setPanelBackgroundImage, 
      panelBackgroundBlur, setPanelBackgroundBlur, 
      enablePlayit, setEnablePlayit, 
      enableTutorial, setEnableTutorial,
      enableLoginAnimation, setEnableLoginAnimation,
      enableRegistration, setEnableRegistration,
      theme, setTheme,
      buttonColor, setButtonColor,
      uiTheme, setUiTheme,
      enableGoogleLogin, setEnableGoogleLogin,
      firebaseApiKey, setFirebaseApiKey,
      firebaseAuthDomain, setFirebaseAuthDomain,
      firebaseProjectId, setFirebaseProjectId,
      firebaseStorageBucket, setFirebaseStorageBucket,
      firebaseMessagingSenderId, setFirebaseMessagingSenderId,
      firebaseAppId, setFirebaseAppId, defaultRuntime, setDefaultRuntime, runtimeLocked, setRuntimeLocked,
      environment, setEnvironment,
      isDev, setIsDev,
      playitServiceMode, setPlayitServiceMode,
      playitServiceName, setPlayitServiceName,
      healthCheckIntervalMinutes, setHealthCheckIntervalMinutes,
      restartDelaySeconds, setRestartDelaySeconds,
      maxRecoveryAttempts, setMaxRecoveryAttempts,
      allowRecoveryWhilePlayersOnline, setAllowRecoveryWhilePlayersOnline,
      fetchSettings 
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

