'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  rememberMe: z.boolean(),
});

export type AuthFormValues = z.infer<typeof formSchema>;

interface AuthFormSplitScreenProps {
  logo: React.ReactNode;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  onSubmit: (data: AuthFormValues) => Promise<void>;
  forgotPasswordHref?: string;
  createAccountHref?: string;
  /** Shown under the image on the right panel. */
  imageOverlay?: React.ReactNode;
  /** Replaces the "create an account" line — the panel has no self sign-up. */
  footer?: React.ReactNode;
}

/**
 * Split-screen sign-in: form on the left, brand panel on the right.
 *
 * `onSubmit` may reject; the message is shown above the button rather than
 * only logged, because "wrong password" is the one thing this screen has to
 * be able to say.
 */
export function AuthFormSplitScreen({
  logo,
  title,
  description,
  imageSrc,
  imageAlt,
  onSubmit,
  forgotPasswordHref,
  createAccountHref,
  imageOverlay,
  footer,
}: AuthFormSplitScreenProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  const handleFormSubmit = async (data: AuthFormValues) => {
    setIsLoading(true);
    setFormError(null);
    try {
      await onSubmit(data);
      // Deliberately NOT clearing isLoading here. onSubmit resolves as soon as
      // the router is told to navigate, but the dashboard is a server
      // component that still has to load. Clearing it would snap the button
      // back to "Continue" and leave the screen looking frozen until the page
      // swaps. This component unmounts on navigation, so the spinner is the
      // last thing the user sees.
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };

  const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col md:flex-row">
      {/* ------------------------------------------------- left: the form */}
      <div className="flex w-full flex-col items-center justify-center bg-background p-8 md:w-1/2">
        <div className="w-full max-w-md">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6"
          >
            <motion.div variants={itemVariants}>{logo}</motion.div>

            <motion.div variants={itemVariants} className="text-left">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </motion.div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                <motion.div variants={itemVariants}>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="owner@example.com"
                            autoComplete="username"
                            type="email"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••••••"
                              autoComplete="current-password"
                              disabled={isLoading}
                              className="pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((value) => !value)}
                              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="flex items-center justify-between">
                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Keep me signed in</FormLabel>
                      </FormItem>
                    )}
                  />

                  {forgotPasswordHref ? (
                    <a
                      href={forgotPasswordHref}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Forgotten password
                    </a>
                  ) : null}
                </motion.div>

                {formError ? (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {formError}
                  </motion.p>
                ) : null}

                <motion.div variants={itemVariants}>
                  <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin" /> : null}
                    {isLoading ? 'Signing in…' : 'Continue'}
                  </Button>
                </motion.div>
              </form>
            </Form>

            <motion.div variants={itemVariants} className="text-center text-sm text-muted-foreground">
              {footer ??
                (createAccountHref ? (
                  <p>
                    Don&apos;t have an account?{' '}
                    <a
                      href={createAccountHref}
                      className="font-medium text-primary hover:underline"
                    >
                      Create one here
                    </a>
                    .
                  </p>
                ) : null)}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ---------------------------------------------- right: brand panel
          `group` + hover: the photo sits desaturated so the product stays
          monochrome, and comes back to full colour under the cursor. The
          scrim lifts at the same time, otherwise the colour would be hidden
          behind it. */}
      <div className="group relative hidden w-1/2 overflow-hidden bg-sidebar md:block">
        <img
          src={imageSrc}
          alt={imageAlt}
          /* Desaturated on purpose: the panel is monochrome, and a colour
             photograph here would be the only hue in the entire product —
             until you hover it. */
          className="h-full w-full scale-105 object-cover grayscale transition-[filter,transform] duration-700 ease-out group-hover:scale-100 group-hover:grayscale-0 motion-reduce:transition-none"
          /* The gradient below stands on its own, so a blocked or slow image
             degrades to a designed panel instead of a white hole. */
          onError={(event) => {
            event.currentTarget.style.visibility = 'hidden';
          }}
        />
        {/* A scrim, not a curtain: dark enough at the bottom for the copy to
            read, light enough at the top that the photograph still shows. */}
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-out',
            'bg-gradient-to-t from-sidebar via-sidebar/55 to-sidebar/10',
            'group-hover:from-sidebar/80 group-hover:via-sidebar/25 group-hover:to-transparent'
          )}
        />
        <div className="absolute inset-0 bg-black/15 mix-blend-multiply transition-opacity duration-700 group-hover:opacity-0" />
        {imageOverlay ? (
          <div className="absolute inset-0 flex flex-col justify-end p-10 lg:p-12">
            {imageOverlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}
