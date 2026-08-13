export type DispatchWorkflowOptions = {
  token: string
  repository: string
  workflowId: string
  ref: string
  inputs: Record<string, string>
}

export async function dispatchWorkflow(options: DispatchWorkflowOptions) {
  const response = await fetch(
    `https://api.github.com/repos/${options.repository}/actions/workflows/${options.workflowId}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: options.ref,
        inputs: options.inputs,
      }),
    },
  )

  if (response.status !== 204) {
    const details = await response.text()
    throw new Error(
      `GitHub workflow dispatch failed: ${response.status} ${response.statusText}${details ? ` ${details}` : ""}`,
    )
  }
}
