import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, ArrowLeft, ArrowRight } from 'lucide-react';

const addressSchema = z.object({
  zip: z.string().regex(/^\d{5}$/, 'Die Postleitzahl muss genau 5 Ziffern enthalten'),
  city: z.string().min(2, 'Bitte geben Sie den Namen des Ortes an'),
  street: z.string().min(2, 'Bitte geben Sie den Straßennamen an'),
  houseNumber: z.string().min(1, 'Hausnummer ist erforderlich'),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface Step7Props {
  data?: AddressFormData;
  onNext: (data: AddressFormData) => void;
  onBack: () => void;
}

export default function Step7Address({ data, onNext, onBack }: Step7Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: data || {
      zip: '',
      city: '',
      street: '',
      houseNumber: '',
    },
  });

  const onSubmit = (formData: AddressFormData) => {
    onNext(formData);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-highlight px-3 py-1 rounded-full">
          Schritt 7 von 11
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold text-text mt-3">
          Vorteile in Ihrer Region prüfen
        </h2>
        <p className="text-sm text-text-muted mt-2">
          Geben Sie die Adresse der Immobilie an. Wir prüfen regionale Fördergelder und Anschlussbedingungen.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-surface border border-border rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-2 pb-4 border-b border-border mb-2">
          <MapPin className="text-primary" size={20} />
          <h3 className="font-bold text-text text-base">Standort der Immobilie</h3>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label htmlFor="zip" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              PLZ
            </label>
            <input
              id="zip"
              type="text"
              maxLength={5}
              placeholder="e.g. 28195"
              className={`input-base ${errors.zip ? 'border-red-400 focus:border-red-500' : ''}`}
              {...register('zip')}
            />
            {errors.zip && (
              <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug">{errors.zip.message}</p>
            )}
          </div>

          <div className="col-span-2">
            <label htmlFor="city" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Ort
            </label>
            <input
              id="city"
              type="text"
              placeholder="e.g. Bremen"
              className={`input-base ${errors.city ? 'border-red-400 focus:border-red-500' : ''}`}
              {...register('city')}
            />
            {errors.city && (
              <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug">{errors.city.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label htmlFor="street" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Straße
            </label>
            <input
              id="street"
              type="text"
              placeholder="e.g. Hauptstraße"
              className={`input-base ${errors.street ? 'border-red-400 focus:border-red-500' : ''}`}
              {...register('street')}
            />
            {errors.street && (
              <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug">{errors.street.message}</p>
            )}
          </div>

          <div className="col-span-1">
            <label htmlFor="houseNumber" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Hausnummer
            </label>
            <input
              id="houseNumber"
              type="text"
              placeholder="e.g. 42a"
              className={`input-base ${errors.houseNumber ? 'border-red-400 focus:border-red-500' : ''}`}
              {...register('houseNumber')}
            />
            {errors.houseNumber && (
              <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug">{errors.houseNumber.message}</p>
            )}
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Zurück
          </button>
          
          <button
            type="submit"
            className="btn-accent flex items-center gap-2 cursor-pointer"
          >
            Weiter <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
