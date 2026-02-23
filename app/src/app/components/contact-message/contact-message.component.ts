import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonItem, IonInput, IonTextarea } from "@ionic/angular/standalone";
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-contact-message',
  templateUrl: './contact-message.component.html',
  styleUrls: ['./contact-message.component.scss'],
  imports: [
    ReactiveFormsModule, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonButton, 
    IonContent, 
    IonItem, 
    IonInput, 
    IonTextarea],
})
export class ContactMessageComponent {
  private readonly apiBaseUrl = environment.apiUrl;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    phone: ['', [Validators.required, Validators.maxLength(30)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    message: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  isSubmitting = false;

  constructor(
    private fb: FormBuilder, 
    private http: HttpClient, 
    private modalCtrl: ModalController, 
    private toastCtrl: ToastController) { }

  close() {
    this.modalCtrl.dismiss();
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    console.log('Submitting form', this.form.getRawValue());
    console.log('API Base URL', this.apiBaseUrl);
    this.isSubmitting = true;
    try {
      await this.http.post(`${this.apiBaseUrl}/api/messages`, this.form.getRawValue()).toPromise();

      const toast =  await this.toastCtrl.create({
        message: 'Message sent!',
        duration: 2000,
        position: 'bottom'      
      });

      await toast.present();
      this.form.reset();
      this.close();

    } finally {
      this.isSubmitting = false;
    }
  }

}
