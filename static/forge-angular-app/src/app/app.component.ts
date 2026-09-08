import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {NgbTooltipConfig} from '@ng-bootstrap/ng-bootstrap';
import {JiraService} from './services/jira.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  /**
   * NULL until the check resolves, so the gate never flashes before the answer.
   * Only an explicit false hides the app.
   */
  licensed: boolean = null;

  constructor(config: NgbTooltipConfig, private router: Router) {
    config.openDelay = 500;
    config.container = 'body';
  }

  /**
   * The one architectural change in the port. Connect put the route in each
   * module's descriptor URL; Forge loads ONE bundle for every module and hands
   * you a context instead, so the app routes itself on arrival.
   */
  async ngOnInit(): Promise<void> {
    // Before routing, and it costs nothing extra — this reads the same cached
    // context getModuleKey is about to. Fails OPEN: a check that throws must
    // never lock out a licensed user. hasValidLicense already treats a missing
    // licence object off production as licensed, so dev installs are unaffected;
    // only an explicit `license.active === false` reaches the gate.
    this.licensed = await JiraService.isValidPaidApplication().catch(() => true);
    if (this.licensed === false) {
      // Hides the routed component from styles.scss rather than removing the
      // outlet: the router needs its outlet, and this can flip after routing
      // has already happened.
      document.documentElement.classList.add('aq-unlicensed');
    }

    let moduleKey: string | undefined;
    let type: string | undefined;
    let projectId: string | undefined;

    try {
      ({moduleKey, type, projectId} = await JiraService.getModuleKey());
    } catch (error) {
      // No context outside a Forge iframe (plain `ng serve`). Leave the router
      // alone: a throw during bootstrap stops Angular rendering entirely, which
      // presents as a blank panel and reads like a CSS bug.
      console.warn('No Forge context; skipping module routing.', error);
      return;
    }

    // Same keys the Connect descriptor used — unchanged by the port.
    switch (moduleKey) {
      case 'advanced-queues-project':
        this.router.navigate([`/project/${projectId}/queues`]);
        return;
      case 'project-enablement':
        this.router.navigate(['/app-admin-panel/project-enablement']);
        return;
    }

    // Fallback on the module TYPE, for contexts that omit moduleKey. It cannot
    // tell two modules of the same kind apart, so it is a last resort.
    switch (type) {
      case 'jira:projectPage':
        this.router.navigate([`/project/${projectId}/queues`]);
        break;
      case 'jira:adminPage':
        this.router.navigate(['/app-admin-panel/project-enablement']);
        break;
      default:
        console.warn(`Unrecognised Forge module: moduleKey=${moduleKey} type=${type}`);
    }
  }
}
