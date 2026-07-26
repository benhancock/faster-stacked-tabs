import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

interface FasterStackedTabsSettings {
  durationMs: number;
}

interface PatchedContainer {
  element: HTMLElement;
  originalDescriptor: PropertyDescriptor | undefined;
  nativeScrollTo: HTMLElement["scrollTo"];
}

interface CompatibleSettingDefinition {
  name: string;
  desc: string;
  control: {
    type: "slider";
    key: "durationMs";
    defaultValue: number;
    min: number;
    max: number;
    step: number;
  };
}

const DEFAULT_SETTINGS: FasterStackedTabsSettings = {
  durationMs: 120
};

const MIN_DURATION_MS = 40;
const MAX_DURATION_MS = 400;
const DURATION_STEP_MS = 10;
const TAB_CONTAINER_SELECTOR =
  ".workspace-split.mod-root .workspace-tabs .workspace-tab-container";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isSavedSettings(
  value: unknown
): value is Partial<FasterStackedTabsSettings> {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("durationMs" in value) || typeof value.durationMs === "number")
  );
}

export default class FasterStackedTabs extends Plugin {
  settings: FasterStackedTabsSettings = Object.assign({}, DEFAULT_SETTINGS);

  private readonly patchedContainers = new Map<HTMLElement, PatchedContainer>();
  private readonly animationFrames = new Map<HTMLElement, number>();
  private readonly workspaceRoots = new Set<HTMLElement>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new FasterStackedTabsSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.workspaceRoots.add(this.app.workspace.containerEl);
      this.patchTabContainers();
      this.registerEvent(
        this.app.workspace.on("layout-change", () => {
          this.patchTabContainers();
        })
      );
      this.registerEvent(
        this.app.workspace.on("window-open", (workspaceWindow) => {
          this.workspaceRoots.add(workspaceWindow.doc.body);
          this.patchTabContainers();
        })
      );
      this.registerEvent(
        this.app.workspace.on("window-close", (workspaceWindow) => {
          this.restoreTabContainers(workspaceWindow.doc.body);
          this.workspaceRoots.delete(workspaceWindow.doc.body);
        })
      );
    });

    this.register(() => {
      this.restoreTabContainers();
    });
  }

  async setDuration(durationMs: number): Promise<void> {
    this.settings.durationMs = clamp(
      durationMs,
      MIN_DURATION_MS,
      MAX_DURATION_MS
    );
    await this.saveData(this.settings);
  }

  private async loadSettings(): Promise<void> {
    const savedData: unknown = await this.loadData();
    const savedSettings = isSavedSettings(savedData) ? savedData : {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
    this.settings.durationMs = clamp(
      this.settings.durationMs,
      MIN_DURATION_MS,
      MAX_DURATION_MS
    );
  }

  private patchTabContainers(): void {
    for (const workspaceRoot of this.workspaceRoots) {
      const containers = workspaceRoot.querySelectorAll<HTMLElement>(
        TAB_CONTAINER_SELECTOR
      );

      for (const container of containers) {
        if (!this.patchedContainers.has(container)) {
          this.patchTabContainer(container);
        }
      }
    }
  }

  private patchTabContainer(element: HTMLElement): void {
    const originalDescriptor = Object.getOwnPropertyDescriptor(element, "scrollTo");
    const nativeScrollTo = element.scrollTo.bind(element);
    const cancelAnimation = (): void => {
      this.cancelAnimation(element);
    };
    const animateHorizontalScroll = (requestedLeft: number): void => {
      this.animateHorizontalScroll(element, requestedLeft);
    };

    function patchedScrollTo(options?: ScrollToOptions): void;
    function patchedScrollTo(x: number, y: number): void;
    function patchedScrollTo(
      first?: ScrollToOptions | number,
      second?: number
    ): void {
      if (typeof first === "number") {
        cancelAnimation();
        nativeScrollTo(first, second ?? element.scrollTop);
        return;
      }

      const options = first ?? {};
      const stackedTabs = element.closest(".workspace-tabs.mod-stacked");
      if (
        !stackedTabs ||
        options.behavior !== "smooth" ||
        typeof options.left !== "number"
      ) {
        cancelAnimation();
        nativeScrollTo(options);
        return;
      }

      animateHorizontalScroll(options.left);
    }

    Object.defineProperty(element, "scrollTo", {
      configurable: true,
      value: patchedScrollTo,
      writable: true
    });

    this.patchedContainers.set(element, {
      element,
      nativeScrollTo,
      originalDescriptor
    });
  }

  private animateHorizontalScroll(element: HTMLElement, requestedLeft: number): void {
    this.cancelAnimation(element);

    const ownerWindow = element.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }

    const startLeft = element.scrollLeft;
    const maximumLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const targetLeft = clamp(requestedLeft, 0, maximumLeft);
    const distance = targetLeft - startLeft;

    if (Math.abs(distance) < 1) {
      element.scrollLeft = targetLeft;
      return;
    }

    const startTime = ownerWindow.performance.now();
    const duration = this.settings.durationMs;

    const step = (now: number): void => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      element.scrollLeft = startLeft + distance * easedProgress;

      if (progress < 1) {
        const frame = ownerWindow.requestAnimationFrame(step);
        this.animationFrames.set(element, frame);
      } else {
        this.animationFrames.delete(element);
      }
    };

    const frame = ownerWindow.requestAnimationFrame(step);
    this.animationFrames.set(element, frame);
  }

  private cancelAnimation(element: HTMLElement): void {
    const frame = this.animationFrames.get(element);
    const ownerWindow = element.ownerDocument.defaultView;
    if (frame !== undefined && ownerWindow) {
      ownerWindow.cancelAnimationFrame(frame);
    }
    this.animationFrames.delete(element);
  }

  private restoreTabContainers(workspaceRoot?: HTMLElement): void {
    for (const patched of this.patchedContainers.values()) {
      if (workspaceRoot && !workspaceRoot.contains(patched.element)) {
        continue;
      }
      this.cancelAnimation(patched.element);
      if (patched.originalDescriptor) {
        Object.defineProperty(
          patched.element,
          "scrollTo",
          patched.originalDescriptor
        );
      } else {
        Reflect.deleteProperty(patched.element, "scrollTo");
      }
      this.patchedContainers.delete(patched.element);
    }
    if (!workspaceRoot) {
      this.workspaceRoots.clear();
    }
  }
}

class FasterStackedTabsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: FasterStackedTabs) {
    super(app, plugin);
  }

  getSettingDefinitions(): CompatibleSettingDefinition[] {
    return [
      {
        name: "Animation duration",
        desc: "How long stacked tabs take to slide into place.",
        control: {
          type: "slider",
          key: "durationMs",
          defaultValue: DEFAULT_SETTINGS.durationMs,
          min: MIN_DURATION_MS,
          max: MAX_DURATION_MS,
          step: DURATION_STEP_MS
        }
      }
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Animation duration")
      .setDesc("How long stacked tabs take to slide into place.")
      .addSlider((slider) => {
        slider
          .setLimits(MIN_DURATION_MS, MAX_DURATION_MS, DURATION_STEP_MS)
          .setValue(this.plugin.settings.durationMs)
          .setDynamicTooltip()
          .onChange(async (value) => {
            await this.plugin.setDuration(value);
          });
      })
      .addExtraButton((button) => {
        button
          .setIcon("reset")
          .setTooltip("Reset to default")
          .onClick(async () => {
            await this.plugin.setDuration(DEFAULT_SETTINGS.durationMs);
            this.display();
          });
      });
  }
}
