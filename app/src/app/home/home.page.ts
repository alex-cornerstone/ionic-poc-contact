import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonButton } from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { ContactMessageComponent } from '../components/contact-message/contact-message.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonButton],
})
export class HomePage {
  constructor(private modalCtrl: ModalController, private router: Router) {}

  goToContacts() {
    this.router.navigate(['/contacts']);
  }

  async openContact() {
    const modal = await this.modalCtrl.create({
      component: ContactMessageComponent
    });
    await modal.present();
  }
}
