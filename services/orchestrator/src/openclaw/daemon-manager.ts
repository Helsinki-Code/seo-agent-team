import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { RuntimeConfig } from "../config.js";
import type { Repository } from "../repository.js";
import { runCommand, splitShellWords } from "../tools/command-runner.js";

type CampaignDispatch = {
  campaignId: string;
  targetUrl?: string | null;
  seedTopic?: string | null;
};

export class OpenClawDaemonManager {
  private daemonProcess: ChildProcess | null = null;
  private restarting = false;

  constructor(
    private readonly config: RuntimeConfig,
    private readonly repository: Repository
  ) {}

  async start(): Promise<void> {
    if (this.daemonProcess) {
      return;
    }

    await mkdir(this.runtimeQueueDir, { recursive: true });

    const [command, ...commandArgs] = splitShellWords(this.config.OPENCLAW_DAEMON_COMMAND);
    if (!command) {
      throw new Error("OPENCLAW_DAEMON_COMMAND cannot be empty.");
    }

    this.daemonProcess = spawn(command, commandArgs, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    this.daemonProcess.on("error", async (error) => {
      this.daemonProcess = null;
      await this.repository.logSafe({
        agentName: "OpenClaw",
        level: "error",
        state: "daemon_spawn_error",
        message: `OpenClaw daemon spawn error: ${error.message}`
      });
    });

    this.daemonProcess.stdout?.on("data", (chunk: Buffer) => {
      void this.repository.logSafe({
        agentName: "OpenClaw",
        state: "daemon_stdout",
        message: chunk.toString("utf8").trim()
      });
    });

    this.daemonProcess.stderr?.on("data", (chunk: Buffer) => {
      void this.repository.logSafe({
        agentName: "OpenClaw",
        level: "warn",
        state: "daemon_stderr",
        message: chunk.toString("utf8").trim()
      });
    });

    this.daemonProcess.on("exit", async (code) => {
      this.daemonProcess = null;
      await this.repository.logSafe({
        agentName: "OpenClaw",
        level: code === 0 ? "info" : "error",
        state: "daemon_exited",
        message: `OpenClaw daemon exited with code ${String(code)}`
      });

      if (this.restarting) {
        return;
      }

      this.restarting = true;
      setTimeout(() => {
        this.restarting = false;
        void this.start();
      }, 5000);
    });

    await this.repository.logSafe({
      agentName: "OpenClaw",
      state: "daemon_started",
      message: `OpenClaw daemon started using command "${this.config.OPENCLAW_DAEMON_COMMAND}".`
    });
  }

  async stop(): Promise<void> {
    if (!this.daemonProcess) {
      return;
    }

    this.daemonProcess.kill("SIGTERM");
    this.daemonProcess = null;

    await this.repository.logSafe({
      agentName: "OpenClaw",
      state: "daemon_stopped",
      message: "OpenClaw daemon stopped."
    });
  }

  async dispatchCampaign(dispatch: CampaignDispatch): Promise<void> {
    const queueFile = join(this.runtimeQueueDir, `${Date.now()}-${dispatch.campaignId}.json`);
    await writeFile(queueFile, JSON.stringify(dispatch, null, 2), "utf8");

    await this.repository.logSafe({
      campaignId: dispatch.campaignId,
      agentName: "Shiva",
      state: "campaign_queued",
      message: "Campaign queued for OpenClaw processing.",
      payload: {
        queueFile
      }
    });

    const [command, ...commandArgs] = splitShellWords(this.config.OPENCLAW_DISPATCH_COMMAND);
    if (!command) {
      throw new Error("OPENCLAW_DISPATCH_COMMAND cannot be empty.");
    }

    const result = await runCommand({
      command,
      commandArgs: [...commandArgs, queueFile],
      timeoutMs: 120000
    });

    if (result.exitCode !== 0) {
      await this.repository.logSafe({
        campaignId: dispatch.campaignId,
        agentName: "Shiva",
        level: "error",
        state: "dispatch_failed",
        message: `OpenClaw dispatch command failed: ${result.stderr || result.stdout}`
      });
      throw new Error(result.stderr || result.stdout || "OpenClaw dispatch command failed.");
    }

    await this.repository.logSafe({
      campaignId: dispatch.campaignId,
      agentName: "Shiva",
      state: "dispatch_complete",
      message: "Campaign payload sent to OpenClaw dispatcher.",
      payload: {
        command: this.config.OPENCLAW_DISPATCH_COMMAND,
        queueFile
      }
    });
  }

  get isRunning(): boolean {
    return this.daemonProcess !== null;
  }

  private get runtimeQueueDir(): string {
    return join(this.config.OPENCLAW_RUNTIME_DIR, "queue");
  }
}
