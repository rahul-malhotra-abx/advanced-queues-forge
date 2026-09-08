export interface ProjectSetting {
  addressBarEnabled: boolean;
  frameHeight: number;
  additionalTicketFrames: boolean;
  openframeEnabled: boolean;
}

export const DefaultProjectSettings: ProjectSetting = {
  addressBarEnabled: true,
  frameHeight: 500,
  additionalTicketFrames: true,
  openframeEnabled: true
};
