import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, ArrowLeft, ArrowRight } from 'lucide-react';

const personalInfoSchema = z.object({
  salutation: z.enum(['Herr', 'Frau'], {
    message: 'Bitte wählen Sie eine Anrede aus',
  }),
  name: z
    .string()
    .min(3, 'Bitte geben Sie Ihren Namen an')
    .regex(/\s+/, 'Bitte geben Sie Ihren Vor- und Nachnamen an'),
});

type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

interface Step8Props {
  data?: PersonalInfoFormData;
  onNext: (data: PersonalInfoFormData) => void;
  onBack: () => void;
}

export default function Step8Name({ data, onNext, onBack }: Step8Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: data || {
      salutation: 'Herr',
      name: '',
    },
  });

  const selectedSalutation = watch('salutation');

  const onSubmit = (formData: PersonalInfoFormData) => {
    onNext(formData);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-highlight px-3 py-1 rounded-full">
          Schritt 8 von 11
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold text-text mt-3">
          Für wen dürfen wir den Check erstellen?
        </h2>
        <p className="text-sm text-text-muted mt-2">
          Bitte geben Sie Ihren Namen an, damit wir Ihre Einschätzung persönlich adressieren können.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-surface border border-border rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-2 pb-4 border-b border-border mb-2">
          <User className="text-primary" size={20} />
          <h3 className="font-bold text-text text-base">Persönliche Angaben</h3>
        </div>

        {/* Salutation selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            Anrede
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setValue('salutation', 'Herr')}
              className={`py-3 px-4 rounded-lg border text-center font-semibold transition-all duration-200 focus:outline-none cursor-pointer ${selectedSalutation === 'Herr'
                  ? 'border-primary bg-primary/[0.04] text-primary shadow-xs'
                  : 'border-border bg-surface text-text hover:border-border-strong hover:bg-surface-alt'
                }`}
            >
              Herr
            </button>
            <button
              type="button"
              onClick={() => setValue('salutation', 'Frau')}
              className={`py-3 px-4 rounded-lg border text-center font-semibold transition-all duration-200 focus:outline-none cursor-pointer ${selectedSalutation === 'Frau'
                  ? 'border-primary bg-primary/[0.04] text-primary shadow-xs'
                  : 'border-border bg-surface text-text hover:border-border-strong hover:bg-surface-alt'
                }`}
            >
              Frau
            </button>
          </div>
          {errors.salutation && (
            <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug">{errors.salutation.message}</p>
          )}
        </div>

        {/* Full Name input */}
        <div>
          <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            Vor- und Nachname
          </label>
          <input
            id="name"
            type="text"
            placeholder="Max Mustermann"
            className={`input-base ${errors.name ? 'border-red-400 focus:border-red-500' : ''}`}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-xs font-semibold text-red-600 mt-1.5 leading-snug">{errors.name.message}</p>
          )}
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
