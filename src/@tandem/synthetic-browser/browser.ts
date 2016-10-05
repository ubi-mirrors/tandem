import { SyntheticLocation } from "./location";
import { SyntheticHTMLDocument, SyntheticWindow } from "./dom";
import { ISyntheticHTMLDocumentRenderer, DOMRenderer, TetherRenderer } from "./renderers";
import {
  bindable,
  MimeTypes,
  Observable,
  TypeWrapBus,
  ChangeAction,
  Dependencies,
  MainBusDependency,
  PropertyChangeAction,
} from "@tandem/common";

import {
  Sandbox,
  SandboxAction,
} from "@tandem/sandbox";

import {
  SyntheticHTMLElementClassDependency
} from "./dependencies";

import { WrapBus } from "mesh";

export class SyntheticBrowser extends Observable {

  private _window: SyntheticWindow;
  private _sandbox: Sandbox;
  private _location: SyntheticLocation;
  private _renderer: ISyntheticHTMLDocumentRenderer;

  constructor(private _dependencies: Dependencies) {
    super();

    // TODO - renderer should not be part of the synthetic browser -- needs
    // to be part of the preview instead.
    this._renderer = new DOMRenderer();
    // this._renderer = new TetherRenderer(MainBusDependency.getInstance(_dependencies));
    this._sandbox = new Sandbox(_dependencies, this.createSandboxGlobals.bind(this));
    this._sandbox.observe(new TypeWrapBus(SandboxAction.EVALUATED, this.onSandboxEvaluated.bind(this)));
  }

  @bindable()
  get window(): SyntheticWindow {
    return this._window;
  }

  get renderer(): ISyntheticHTMLDocumentRenderer {
    return this._renderer;
  }

  get location(): SyntheticLocation {
    return this._location;
  }

  async open(url: string) {
    this._location = new SyntheticLocation(url);
    this._sandbox.open(MimeTypes.HTML, url);
  }

  protected createSandboxGlobals(): SyntheticWindow {
    const window = new SyntheticWindow(this._sandbox, this._location);
    this._registerElements(window);

    // TODO - this shouldn't be here
    window["process"] = {
      env: {
        NODE_ENV: "development"
      }
    };

    return window;
  }

  protected async onSandboxEvaluated(action: SandboxAction) {
    const window = this._sandbox.global as SyntheticWindow;
    await window.document.load();
    if (this._window) {
      this._window.patch(window);
    } else {
      this._window = window;
      this._renderer.target = this._window.document;
    }
  }

  private _registerElements(window: SyntheticWindow) {
    for (const elementClassDependency of SyntheticHTMLElementClassDependency.findAll(this._dependencies)) {
      window.document.registerElement(elementClassDependency.tagName, elementClassDependency.value);
    }
  }
}