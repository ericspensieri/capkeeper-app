import { Component, TemplateRef, HostListener, OnInit } from '@angular/core';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { GlobalService } from '../../services/global.service';
import { TeamService } from '../../services/team.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Idle } from '@ng-idle/core';
import { DEFAULT_INTERRUPTSOURCES } from '@ng-idle/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: false
})
export class LoginComponent implements OnInit {
  modalRef!: BsModalRef;
  email: string = '';
  password: string = '';
  loginError: boolean = false;
  isLargeScreen: boolean = window.innerWidth >= 1024;
  mobileMenuOpen: boolean = false;

  constructor(
    private idle: Idle,
    private router: Router,
    private modalService: BsModalService,
    public globalService: GlobalService,
    private teamService: TeamService,
  ) { 
    initializeApp(environment.firebase);
    this.initIdleTimeout();
  }

  ngOnInit() {
    this.isLargeScreen = window.innerWidth >= 1024;
  }

  private initIdleTimeout() {
    const TIMEOUT_IN_SECONDS = 600;

    this.idle.setIdle(TIMEOUT_IN_SECONDS);
    this.idle.setInterrupts(DEFAULT_INTERRUPTSOURCES);

    this.idle.onTimeout.subscribe(() => {
        this.signOutClicked();
    });

    this.idle.watch();
  }

  signIn() {
    const auth = getAuth();
  
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        return signInWithEmailAndPassword(auth, this.email, this.password);
      })
      .then((userCredential) => {
        this.loginError = false;
        const user = userCredential.user;
  
        if (user.email) {
          this.globalService.recordSession(user.displayName || user.email, 'login');
        }
      })
      .catch((error) => {
        this.loginError = true;
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error('Login failed:', errorCode, errorMessage);
      });
  }

  private loadTeamsAndInitialize(leagueId: string) {
    this.teamService.getTeamsByLeague(leagueId).subscribe((response) => {
        this.globalService.teams = response.teams;
        this.globalService.league = response.league;
        this.globalService.nhl_teams = response.nhl_teams;

        const loggedInUser = this.globalService.loggedInUser;

        if (loggedInUser) {
            const matchedTeam = this.globalService.teams.find(
                (team) => team.team_id === loggedInUser.team_managed
            );

            if (matchedTeam) {
                this.globalService.loggedInTeam = matchedTeam;
                this.globalService.updateTeamCap(matchedTeam);
            }
        }

        this.router.navigate(['/' + leagueId + '/home']);
    });
  }

  signOutClicked(): void {
    const auth = getAuth();
    signOut(auth)
      .then(() => {

        if (this.idle) {
          this.idle.stop();
          console.log('Idle service stopped.');
        }

        if (this.globalService.loggedInUser) {
          this.globalService.recordSession(this.globalService.loggedInUser.user_name, 'logout');
        }
        this.globalService.loggedInUser = null;
        this.router.navigate(['/login']);
      })
      .catch((error) => {
        console.error('Error signing out:', error);
      });
  }

  createAccount() {
    const auth = getAuth();

    createUserWithEmailAndPassword(auth, this.email, this.password)
      .then((userCredential) => {
        const user = userCredential.user;
        console.log('Registration successful:', user);
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error('Registration failed:', errorCode, errorMessage);
      });
  }

  resetPassword() {
    const auth = getAuth();
  
    if (!this.email) {
      console.error('Please enter your email address.');
      return;
    }
    
    sendPasswordResetEmail(auth, this.email)
      .then(() => {
        console.log('Password reset email sent.');
        alert('Password reset email sent. Please check your inbox & junk folder.');
        this.closeModal()
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error('Error sending password reset email:', errorCode, errorMessage);
        alert('Error sending password reset email: ' + errorMessage);
      });
  }

  openModal(template: TemplateRef<any>): void {
    this.modalRef = this.modalService.show(template);
  }

  closeModal() {
    this.modalRef.hide();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.isLargeScreen = window.innerWidth >= 1024;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }
  

}
