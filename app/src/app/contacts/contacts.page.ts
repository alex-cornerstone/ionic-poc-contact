import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonList, IonItem, IonLabel, IonAvatar, IonSpinner,
  IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';

interface Contact {
  id: number;
  name: string;
}

@Component({
  selector: 'app-contacts',
  templateUrl: 'contacts.page.html',
  styleUrls: ['contacts.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonList, IonItem, IonLabel, IonAvatar, IonSpinner,
    IonRefresher, IonRefresherContent,
  ],
})
export class ContactsPage implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;

  contacts: Contact[] = [];
  loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
  }

  async load(event?: any) {
    try {
      this.contacts = await this.http
        .get<Contact[]>(`${this.apiBaseUrl}/api/contacts`)
        .toPromise() ?? [];
    } finally {
      this.loading = false;
      event?.target?.complete();
    }
  }

  getInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
