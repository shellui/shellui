import { useSettings } from "../SettingsContext"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { shellui } from "@shellui/sdk"

export const Develop = () => {
  const { settings, updateSetting } = useSettings()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Logging</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enable or disable logging for specific namespaces. This helps you control which parts of ShellUI output debug information.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="log-shellsdk" className="text-sm font-medium leading-none">
                Show ShellSDK logs
              </label>
              <p className="text-sm text-muted-foreground">
                Enable logging for ShellUI SDK operations
              </p>
            </div>
            <Switch
              id="log-shellsdk"
              checked={settings.logging?.namespaces?.shellsdk || false}
              onCheckedChange={(checked) =>
                updateSetting('logging', {
                  namespaces: {
                    ...settings.logging?.namespaces,
                    shellsdk: checked
                  }
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="log-shellcore" className="text-sm font-medium leading-none">
                Show ShellCore logs
              </label>
              <p className="text-sm text-muted-foreground">
                Enable logging for ShellUI Core operations
              </p>
            </div>
            <Switch
              id="log-shellcore"
              checked={settings.logging?.namespaces?.shellcore || false}
              onCheckedChange={(checked) =>
                updateSetting('logging', {
                  namespaces: {
                    ...settings.logging?.namespaces,
                    shellcore: checked
                  }
                })
              }
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Testing</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Test ShellUI features and functionality.
        </p>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Toast Notifications</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Success!",
                    description: "Operation completed successfully",
                    type: "success",
                  });
                }}
                variant="outline"
              >
                Success Toast
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Error",
                    description: "Something went wrong. Please try again.",
                    type: "error",
                  });
                }}
                variant="outline"
              >
                Error Toast
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Warning",
                    description: "This action may have unintended consequences",
                    type: "warning",
                  });
                }}
                variant="outline"
              >
                Warning Toast
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Information",
                    description: "Here's some useful information for you",
                    type: "info",
                  });
                }}
                variant="outline"
              >
                Info Toast
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Default Toast",
                    description: "This is a default toast notification",
                    type: "default",
                  });
                }}
                variant="outline"
              >
                Default Toast
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Loading...",
                    description: "Please wait while we process your request",
                    type: "loading",
                  });
                }}
                variant="outline"
              >
                Loading Toast
              </Button>
              <Button
                onClick={() => {
                  const toastId = shellui.toast({
                    title: "Processing...",
                    description: "Uploading your file",
                    type: "loading",
                  });

                  // Simulate async operation and update toast
                  if (typeof toastId === 'string') {
                    setTimeout(() => {
                      shellui.toast({
                        id: toastId,
                        type: "success",
                        title: "Upload Complete!",
                        description: "Your file has been uploaded successfully",
                      });
                    }, 2000);
                  }
                }}
                variant="outline"
              >
                Loading → Success Toast
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Toast with Action",
                    description: "This toast has an action button",
                    type: "success",
                    action: {
                      label: "Undo",
                      onClick: () => {
                        shellui.toast({
                          title: "Undone",
                          description: "Action has been undone",
                          type: "info",
                        });
                      },
                    },
                  });
                }}
                variant="outline"
              >
                Toast with Action
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Toast with Action",
                    description: "This toast has an action button",
                    type: "success",
                    action: {
                      label: "Undo",
                      onClick: () => {
                        shellui.toast({
                          title: "Undone",
                          description: "Action has been undone",
                          type: "info",
                        });
                      },
                    },
                    cancel: {
                      label: "Cancel",
                      onClick: () => {
                        shellui.toast({
                          title: "Cancelled",
                          description: "Action has been cancelled",
                          type: "info",
                        });
                      },
                    },
                  });
                }}
                variant="outline"
              >
                Toast with Action AND cancel
              </Button>
              <Button
                onClick={() => {
                  shellui.toast({
                    title: "Persistent Toast",
                    description: "This toast will stay until dismissed (10 seconds)",
                    type: "info",
                    duration: 10000,
                  });
                }}
                variant="outline"
              >
                Long Duration Toast
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
