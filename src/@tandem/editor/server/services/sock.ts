import { IActor } from "@tandem/common/actors";
import { ApplicationServiceDependency } from "@tandem/common/dependencies";
import { CoreApplicationService } from "@tandem/editor/core";
import { IEdtorServerConfig } from "@tandem/editor/server/config";
import { LoadAction, InitializeAction, OpenProjectAction, SockBus, Action } from "@tandem/common";
import * as os from "os";
import * as path from "path";
import * as net from "net";
import * as fsa from "fs-extra";

const SOCK_FILE = path.join(os.tmpdir(), `tandem-${process.env.USER}.sock`);

class ExecAction extends Action {
  static readonly EXEC = "exec";
  constructor(readonly config: IEdtorServerConfig) {
    super(ExecAction.EXEC);
  }
  static execute(config: any, bus: IActor) {
    return bus.execute(new ExecAction(config)).readAll();
  }
}


export class SockService extends CoreApplicationService<IEdtorServerConfig> {

  private _socketFile: string;

  constructor() {
    super();
    this._socketFile = SOCK_FILE;
  }

  /**
   */

  [LoadAction.LOAD](action: LoadAction) {
    return new Promise((resolve, reject) => {
      let bus: IActor;

      const client = net.connect({ path: this._socketFile } as any);

      client.once("connect", async () => {
        await ExecAction.execute(this.config, new SockBus(client, this.bus));
        client.end();
      })

      client.once("error", this._startSocketServer.bind(this));
      client.once("error", resolve);
    });
  }

  [ExecAction.EXEC]({ config }: ExecAction) {
    if (config.argv._.length) {
      OpenProjectAction.execute({ filePath: path.resolve(config.cwd, config.argv._[0]) }, this.bus);
    }
  }

  [InitializeAction.INITIALIZE](action: LoadAction) {
    if (this.config.argv) {
      ExecAction.execute(this.config, this.bus);
    }
  }

  private _startSocketServer() {
    this._deleteSocketFile();
    const server = net.createServer((connection) => {
      new SockBus(connection, this.bus);
    });

    server.listen(SOCK_FILE);
  }

  private _deleteSocketFile() {
    fsa.removeSync(SOCK_FILE);
  }
}