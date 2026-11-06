import hashlib

from django.db import migrations, models


def populate_content_hashes(apps, schema_editor):
    Comment = apps.get_model("comments", "Comment")
    database = schema_editor.connection.alias
    batch = []

    for comment in Comment.objects.using(database).only("pk", "body").iterator(
        chunk_size=1000
    ):
        comment.content_hash = hashlib.sha256(comment.body.encode("utf-8")).hexdigest()
        batch.append(comment)
        if len(batch) == 1000:
            Comment.objects.using(database).bulk_update(
                batch, ["content_hash"], batch_size=1000
            )
            batch.clear()

    if batch:
        Comment.objects.using(database).bulk_update(
            batch, ["content_hash"], batch_size=1000
        )


class Migration(migrations.Migration):

    dependencies = [
        ("comments", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="comment",
            name="content_hash",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.RunPython(populate_content_hashes, migrations.RunPython.noop),
    ]
